import type { CpNode } from 'flo-mat';
import type { MorphEntry, Tether } from '../morph-entry.js';
import type { SleeveSide } from '../anchored-sleeves.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import { buildMorphEntries, buildMorphEntriesOfMatch } from './build-morph-entries.js';
import { matchSegTrees } from '../segment-tree/match-seg-trees/match-seg-trees.js';
import { refineMatch } from '../segment-tree/match-seg-trees/refine-match.js';
import { defaultPathWeights } from '../match-paths/path-cost-weights.js';
import { matchComponents } from '../components/match-components.js';
import { segTreeFromCp } from '../segment-tree/seg-tree-from-cp.js';
import { outlineLoopOf } from '../segment-tree/outline-loop.js';
import { calcProcrustes$ } from '../procrustes/calc-procrustes.js';
import { mapmap } from '../../utils/map-map.js';
import { pAtIndex } from '../fs/p-at-idx.js';
import { identityMatchOf } from '../segment-tree/match-seg-trees/identity-match-of.js';
import { getUnit$ } from '../segment-tree/get-unit.js';
import { matchHoles } from '../holes/match-holes.js';
import { getComponentLoops } from '../holes/get-component-loops.js';

/**
 * The scale a component without a partner shrinks to in the other frame -
 * a point to the eye, while its chords keep their directions.
 */
const SHRINK = 1e-3;
/** skeleton samples per segment when looking for a tether point */
const TETHER_SAMPLES = 16;

const { hypot } = Math;


/** One component (MAT) of a glyph. */
interface GlyphComponent {
    /** a `CpNode` of its MAT - the one the morph is drawn from */
    readonly cp: CpNode;
    /**
     * a `CpNode` of a coarser SAT of it, a sub-tree of `cp`'s (see
     * `markSplitDisks`) - matched first, the match then refined onto `cp`'s
     * tree (`undefined`: matched at `cp`'s scale only)
     */
    readonly coarse: CpNode | undefined;
    /**
     * it with its holes split off - `undefined`: never morphed split
     * (`buildMatchedEntries`)
     */
    readonly split: SplitGlyphComponent | undefined;
}


/** A component with its holes split off (see `SplitComponent`). */
interface SplitGlyphComponent {
    /** the component with its holes filled */
    readonly filled: GlyphComponent;
    /** each hole as a shape, in `getComponentLoops`' order */
    readonly holes: GlyphComponent[];
}


/**
 * Returns the morph entries of a whole glyph pair: the glyphs' components
 * (one MAT each) are matched (`matchComponents`), each matched pair is
 * morphed as usual (`buildMorphEntries`), and each component without a
 * partner shrinks to a point at its own centroid in the other frame
 * (`buildShrinkEntries`), tied to the matched shape at the skeleton point
 * nearest that centroid (`calcTether`) so it moves along with it.
 *
 * * every component's entries are appended as a block, with its glue
 *   indices shifted by the block's offset
 *
 * * the components without a partner come first, then the matched pairs
 *   from the smallest to the largest - the last pair built is the one the
 *   debug match views show (`recordPathMatch` keeps the latest)
 *
 * * a component pair is matched at one scale, or staggered when both have
 *   a coarse MAT (`buildPairEntries`)
 *
 * * a component pair may be morphed split - its filled outlines and its
 *   holes as separate pairs (`buildMatchedEntries`)
 *
 * @param compsA glyph A's components
 * @param compsB glyph B's components
 * @param weights the path cost weights
 */
function buildGlyphMorphEntries(
        compsA: GlyphComponent[],
        compsB: GlyphComponent[],
        weights: Partial<PathCostWeights>): MorphEntry[] {

    const loopsA = compsA.map(c => outlineLoopOf(c.cp));
    const loopsB = compsB.map(c => outlineLoopOf(c.cp));

    const { pairs, onlyA, onlyB } = matchComponents(loopsA, loopsB);

    const blocks: MorphEntry[][] = [
        ...onlyA.map(i => buildShrinkEntries(compsA[i], loopsA[i], 'a', weights)),
        ...onlyB.map(j => buildShrinkEntries(compsB[j], loopsB[j], 'b', weights)),
        ...pairs
            .toSorted(([i1], [i2]) =>
                calcProcrustes$(loopsA[i1]).scale -
                calcProcrustes$(loopsA[i2]).scale)
            .map(([i, j]) => buildMatchedEntries(
                compsA[i], compsB[j], loopsA[i], loopsB[j], weights))
    ];

    const entries = concatBlocks(blocks);

    // each component without a partner is tied to the matched shape at
    // the skeleton point nearest its centroid
    const centroids = [
        ...onlyA.map(i => calcProcrustes$(loopsA[i]).centroid),
        ...onlyB.map(j => calcProcrustes$(loopsB[j]).centroid)
    ];
    let lone = 0;
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.lone !== true || e.glue !== undefined) { continue; }

        const p = centroids[lone++];
        const tether = e.collapsed === 'b'
            ? calcTether(entries, p, undefined)
            : calcTether(entries, undefined, p);
        if (tether !== undefined) { entries[i] = { ...e, tether }; }
    }

    return entries;
}


/**
 * Returns the blocks of entries concatenated, each block's entry indices
 * (its glues' and tethers') shifted by the block's offset.
 */
function concatBlocks(
        blocks: MorphEntry[][]): MorphEntry[] {

    const entries: MorphEntry[] = [];
    for (const block of blocks) {
        const offset = entries.length;
        for (const e of block) {
            const { glue, tether } = e;
            entries.push({
                ...e,
                ...(glue !== undefined ? { glue: { ...glue, e: glue.e + offset } } : {}),
                ...(tether !== undefined ? { tether: { ...tether, e: tether.e + offset } } : {})
            });
        }
    }

    return entries;
}


/**
 * Returns the morph entries of a matched component pair:
 *
 * * split (both `split`, both with holes, and every hole matched -
 *   `matchHoles`): the filled components' entries, then each hole pair's
 *   (marked `hole`, cut out when drawn) - each hole tied to the filled
 *   skeleton at the point nearest it in both frames (`calcTether`), so it
 *   moves along with the filled shape instead of on its own straight path
 *
 * * else: the pair's entries (`buildPairEntries`)
 *
 * @param a the component of A
 * @param b the component of B
 * @param loopA its outline loop
 * @param loopB its outline loop
 * @param weights the path cost weights
 */
function buildMatchedEntries(
        a: GlyphComponent,
        b: GlyphComponent,
        loopA: number[][][],
        loopB: number[][][],
        weights: Partial<PathCostWeights>): MorphEntry[] {

    const { split: splitA } = a;
    const { split: splitB } = b;

    const pairs = splitA !== undefined && splitB !== undefined &&
        splitA.holes.length > 0 && splitB.holes.length > 0
        ? getAllHolePairs(a.cp, b.cp)
        : undefined;

    if (splitA === undefined || splitB === undefined || pairs === undefined) {
        return buildPairEntries(a, b, loopA, loopB, weights);
    }

    const filled = buildSplitEntries(splitA.filled, splitB.filled, weights);
    const holeBlocks = pairs.map(([i, j]) =>
        buildSplitEntries(splitA.holes[i], splitB.holes[j], weights)
            .map(e => ({ ...e, hole: true as const })));

    // (the filled block first, so its indices stay put)
    const entries = concatBlocks([filled, ...holeBlocks]);

    let offset = filled.length;
    for (let n = 0; n < pairs.length; n++) {
        const [i, j] = pairs[n];
        const tether = calcTether(
            filled,
            calcProcrustes$(outlineLoopOf(splitA.holes[i].cp)).centroid,
            calcProcrustes$(outlineLoopOf(splitB.holes[j].cp)).centroid);

        const end = offset + holeBlocks[n].length;
        for (let k = offset; k < end; k++) {
            const e = entries[k];
            if (e.glue === undefined && tether !== undefined) {
                entries[k] = { ...e, tether };
            }
        }
        offset = end;
    }

    return entries;
}


/**
 * Returns the hole pairs of a component pair if every hole of both is
 * matched (`matchHoles`), else `undefined`.
 *
 * @param cpA a `CpNode` of the component of A
 * @param cpB a `CpNode` of the component of B
 */
function getAllHolePairs(
        cpA: CpNode,
        cpB: CpNode): [number, number][] | undefined {

    const { match } = matchHoles(getComponentLoops(cpA), getComponentLoops(cpB));
    const { pairs, onlyA, onlyB } = match;

    return onlyA.length === 0 && onlyB.length === 0 ? pairs : undefined;
}


/**
 * Returns the morph entries of a split-off pair (filled components or
 * holes), each a single loop shape.
 */
function buildSplitEntries(
        a: GlyphComponent,
        b: GlyphComponent,
        weights: Partial<PathCostWeights>): MorphEntry[] {

    return buildPairEntries(
        a, b, outlineLoopOf(a.cp), outlineLoopOf(b.cp), weights);
}


/**
 * Returns the morph entries of a component pair:
 *
 * * both with a coarse MAT: their coarse trees are matched, the match is
 *   refined onto their trees (`refineMatch`) and the morph built from that
 *
 * * else: matched and built on their trees (`buildMorphEntries`)
 *
 * @param a the component of A
 * @param b the component of B
 * @param loopA its outline loop
 * @param loopB its outline loop
 * @param weights the path cost weights
 */
function buildPairEntries(
        a: GlyphComponent,
        b: GlyphComponent,
        loopA: number[][][],
        loopB: number[][][],
        weights: Partial<PathCostWeights>): MorphEntry[] {

    const gA = segTreeFromCp(a.cp);
    const gB = segTreeFromCp(b.cp);

    if (a.coarse === undefined || b.coarse === undefined) {
        return buildMorphEntries(gA, gB, loopA, loopB, weights);
    }

    const fullWeights = { ...defaultPathWeights, ...weights };
    const coarse = matchSegTrees(
        segTreeFromCp(a.coarse), segTreeFromCp(b.coarse),
        loopA, loopB, fullWeights);
    const trunk = refineMatch(coarse, gA, gB, loopA, loopB, fullWeights);

    return buildMorphEntriesOfMatch(trunk, gA, gB, loopA, loopB, fullWeights);
}


/**
 * Returns the tether (`Tether`) to the skeleton point of the matched
 * entries nearest the point(s) to tie - `undefined` if there are no matched
 * entries.
 *
 * * a point in one frame (a component without a partner): the nearest
 *   skeleton point in that frame (`side` 'a' or 'b')
 *
 * * a point in each frame (a hole): the skeleton point of the least summed
 *   distance to both, each in its frame (`side` 'both')
 *
 * * matched entries are the ones neither collapsed nor `lone` - their
 *   skeleton exists in both frames, point for point - nor `hole` (a hole's
 *   skeleton lies in empty space)
 *
 * * the skeleton is sampled at `TETHER_SAMPLES` points per segment
 *
 * @param entries the morph entries
 * @param pA the point to tie in frame A (`undefined`: none)
 * @param pB the point to tie in frame B (`undefined`: none)
 */
function calcTether(
        entries: MorphEntry[],
        pA: number[] | undefined,
        pB: number[] | undefined): Tether | undefined {

    const side = pA === undefined ? 'b' : pB === undefined ? 'a' : 'both';

    let best: Tether | undefined;
    let bestD = Infinity;
    for (let e = 0; e < entries.length; e++) {
        const { skelPssA, skelPssB, collapsed, lone, hole } = entries[e];
        if (collapsed !== undefined || lone === true || hole === true) {
            continue;
        }

        for (let j = 0; j < skelPssA.length; j++) {
            for (let s = 0; s <= TETHER_SAMPLES; s++) {
                const k = j + s/TETHER_SAMPLES;
                const d =
                    calcDistTo(skelPssA, k, pA) + calcDistTo(skelPssB, k, pB);
                if (d < bestD) { bestD = d; best = { e, k, side }; }
            }
        }
    }

    return best;
}


/**
 * Returns the distance from the skeleton point at fractional index `k` to
 * `p` (`0` if there is no `p`).
 */
function calcDistTo(
        pss: number[][][],
        k: number,
        p: number[] | undefined): number {

    if (p === undefined) { return 0; }

    const q = pAtIndex(pss, k);

    return hypot(q[0] - p[0], q[1] - p[1]);
}


/**
 * Returns the morph entries of a component without a partner: it shrinks to
 * a point at its centroid (`side` 'a': it exists only in A) or grows from
 * one (`side` 'b').
 *
 * * the entries come from morphing the component onto itself as the
 *   identity (`identityMatchOf` - no DTW), but only their real frame
 *   (`side`'s) is kept: the other frame is that same frame shrunk by
 *   `SHRINK` about the centroid
 *
 * * the sleeves are stored in local frames (disk-relative anchors,
 *   chord-normalized pieces), so the real frame's sleeves serve the shrunk
 *   frame too, and scaling the skeleton and the radii scales the outline
 *
 * * a glued entry's junction stays at its real-frame place on its parent
 *
 * * every entry is marked `collapsed` in the shrunk frame, so the frame
 *   alignment keeps the component in its own glyph's coordinates, and
 *   `lone`, so the pose measurement leaves it out
 *
 * @param comp the component
 * @param loop the component's outline loop
 * @param side the glyph the component belongs to
 * @param weights the path cost weights
 */
function buildShrinkEntries(
        comp: GlyphComponent,
        loop: number[][][],
        side: 'a' | 'b',
        weights: Partial<PathCostWeights>): MorphEntry[] {

    const [cx, cy] = calcProcrustes$(loop).centroid;

    function shrink(p: number[]): number[] {
        return [cx + SHRINK*(p[0] - cx), cy + SHRINK*(p[1] - cy)];
    }

    const g = segTreeFromCp(comp.cp);
    const self = buildMorphEntriesOfMatch(
        identityMatchOf(g, getUnit$(loop)), g, g, loop, loop,
        { ...defaultPathWeights, ...weights });

    return self.map(e => {
        const { skelPssA, skelPssB, ra, rb, sleeveOut, sleeveBack, glue } = e;

        return side === 'a'
            ? {
                ...e,
                skelPssB: mapmap(skelPssA, shrink),
                rb: ra.map(r => SHRINK*r),
                sleeveOut: copySleeveFrame(sleeveOut, 'a'),
                sleeveBack: copySleeveFrame(sleeveBack, 'a'),
                ...(glue !== undefined ? { glue: { ...glue, k2: glue.k1 } } : {}),
                collapsed: 'b',
                lone: true
            }
            : {
                ...e,
                skelPssA: mapmap(skelPssB, shrink),
                ra: rb.map(r => SHRINK*r),
                sleeveOut: copySleeveFrame(sleeveOut, 'b'),
                sleeveBack: copySleeveFrame(sleeveBack, 'b'),
                ...(glue !== undefined ? { glue: { ...glue, k1: glue.k2 } } : {}),
                collapsed: 'a',
                lone: true
            };
    });
}


/**
 * Returns the sleeve side with frame `from`'s anchors and pieces in both
 * frames.
 */
function copySleeveFrame(
        side: SleeveSide,
        from: 'a' | 'b'): SleeveSide {

    const { anchorsA, anchorsB, piecesA, piecesB } = side;
    const anchors = from === 'a' ? anchorsA : anchorsB;
    const pieces = from === 'a' ? piecesA : piecesB;

    return { anchorsA: anchors, anchorsB: anchors, piecesA: pieces, piecesB: pieces };
}


export { buildGlyphMorphEntries }
export type { GlyphComponent }
