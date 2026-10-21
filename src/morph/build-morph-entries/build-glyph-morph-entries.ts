import type { CpNode } from 'flo-mat';
import type { MorphEntry, Tether } from '../morph-entry.js';
import type { SleeveSide } from '../anchored-sleeves.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import { buildMorphEntries } from './build-morph-entries.js';
import { matchComponents } from '../components/match-components.js';
import { segTreeFromCp } from '../segment-tree/seg-tree-from-cp.js';
import { outlineLoopOf } from '../segment-tree/outline-loop.js';
import { calcProcrustes$ } from '../procrustes/calc-procrustes.js';
import { mapmap } from '../../utils/map-map.js';
import { pAtIndex } from '../fs/p-at-idx.js';


/**
 * The scale a component without a partner shrinks to in the other frame -
 * a point to the eye, while its chords keep their directions.
 */
const SHRINK = 1e-3;
/** skeleton samples per segment when looking for a tether point */
const TETHER_SAMPLES = 16;

const { hypot } = Math;


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
 * @param cpsA glyph A's MATs (a `CpNode` of each)
 * @param cpsB glyph B's MATs (a `CpNode` of each)
 * @param weights the path cost weights
 */
function buildGlyphMorphEntries(
        cpsA: CpNode[],
        cpsB: CpNode[],
        weights: Partial<PathCostWeights>): MorphEntry[] {

    const loopsA = cpsA.map(outlineLoopOf);
    const loopsB = cpsB.map(outlineLoopOf);

    const { pairs, onlyA, onlyB } = matchComponents(loopsA, loopsB);

    const blocks: MorphEntry[][] = [
        ...onlyA.map(i => buildShrinkEntries(cpsA[i], loopsA[i], 'a', weights)),
        ...onlyB.map(j => buildShrinkEntries(cpsB[j], loopsB[j], 'b', weights)),
        ...pairs
            .toSorted(([i1], [i2]) =>
                calcProcrustes$(loopsA[i1]).scale -
                calcProcrustes$(loopsA[i2]).scale)
            .map(([i, j]) => buildMorphEntries(
                segTreeFromCp(cpsA[i]), segTreeFromCp(cpsB[j]),
                loopsA[i], loopsB[j], weights))
    ];

    const entries: MorphEntry[] = [];
    for (const block of blocks) {
        const offset = entries.length;
        entries.push(...block.map(e => e.glue === undefined
            ? e
            : { ...e, glue: { ...e.glue, e: e.glue.e + offset } }));
    }

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

        const side = e.collapsed === 'b' ? 'a' : 'b';
        const tether = calcTether(entries, centroids[lone++], side);
        if (tether !== undefined) { entries[i] = { ...e, tether }; }
    }

    return entries;
}


/**
 * Returns the tether (`Tether`) to the skeleton point of the matched
 * entries nearest `p`, in frame `side` - `undefined` if there are no
 * matched entries.
 *
 * * matched entries are the ones neither collapsed nor `lone` - their
 *   skeleton exists in both frames, point for point
 *
 * * the skeleton is sampled at `TETHER_SAMPLES` points per segment
 *
 * @param entries the morph entries
 * @param p the point to tie (a component's centroid)
 * @param side the frame `p` is in
 */
function calcTether(
        entries: MorphEntry[],
        p: number[],
        side: 'a' | 'b'): Tether | undefined {

    let best: Tether | undefined;
    let bestD = Infinity;
    for (let e = 0; e < entries.length; e++) {
        const { skelPssA, skelPssB, collapsed, lone } = entries[e];
        if (collapsed !== undefined || lone === true) { continue; }

        const pss = side === 'a' ? skelPssA : skelPssB;
        for (let j = 0; j < pss.length; j++) {
            for (let s = 0; s <= TETHER_SAMPLES; s++) {
                const k = j + s/TETHER_SAMPLES;
                const q = pAtIndex(pss, k);
                const d = hypot(q[0] - p[0], q[1] - p[1]);
                if (d < bestD) { bestD = d; best = { e, k, side }; }
            }
        }
    }

    return best;
}


/**
 * Returns the morph entries of a component without a partner: it shrinks to
 * a point at its centroid (`side` 'a': it exists only in A) or grows from
 * one (`side` 'b').
 *
 * * the entries come from morphing the component onto itself, but only
 *   their real frame (`side`'s) is kept: the other frame is that same frame
 *   shrunk by `SHRINK` about the centroid - the self-match need not be the
 *   identity (a symmetric piece matches itself reversed as cheaply), which
 *   would turn the piece as it shrinks
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
 * @param cp a `CpNode` of the component's MAT
 * @param loop the component's outline loop
 * @param side the glyph the component belongs to
 * @param weights the path cost weights
 */
function buildShrinkEntries(
        cp: CpNode,
        loop: number[][][],
        side: 'a' | 'b',
        weights: Partial<PathCostWeights>): MorphEntry[] {

    const sg = segTreeFromCp(cp);
    const [cx, cy] = calcProcrustes$(loop).centroid;

    function shrink(p: number[]): number[] {
        return [cx + SHRINK*(p[0] - cx), cy + SHRINK*(p[1] - cy)];
    }

    return buildMorphEntries(sg, sg, loop, loop, weights).map(e => {
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
