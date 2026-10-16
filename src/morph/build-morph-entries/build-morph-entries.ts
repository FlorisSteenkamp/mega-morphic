import type { MorphEntry, Glue } from '../morph-entry.js';
import type { AnchorPair } from '../align-branches.js';
import type { SegMatchedPair } from '../segment-tree/match-seg-trees/seg-matched-pair.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { Segment } from '../segment-tree/segment.js';
import { getShapeArea } from 'flo-boolean';
import { matchSegTrees } from '../segment-tree/match-seg-trees/match-seg-trees.js';
import { defaultPathWeights } from '../match-paths/path-cost-weights.js';
import { recordPathMatch } from '../../debug/record-path-match.js';
import { composeRouteGeom } from '../segment-tree/compose-segs.js';
import { alignBranches, resampleAt } from '../align-branches.js';
import { buildSleeveSides } from '../anchored-sleeves.js';
import { calcSkelCumKnots } from '../fs/skeleton-knots.js';
import { getLastP } from '../fs/get-last-p.js';
import { boundaries } from '../fs/boundaries.js';
import { clamp } from '../../utils/clamp.js';
import { matchColors } from '../../page/events/match-colors.js';
import { nearestIdx } from '../nearest-idx.js';
import { placeTopology } from '../place-topology.js';
import { getUnit$ } from '../segment-tree/get-unit.js';
import { lenOf$ } from '../segment-tree/len-of.js';
import { pairsOf } from '../segment-tree/match-seg-trees/pairs-of.js';


/**
 * Matches the two segment trees route-wise (DTW alignability as the
 * matching metric) and builds the full set of morph entries: each matched
 * route pair becomes one feature-aligned entry, matched child forks along
 * the whole route are alignment anchors and glue points, and every
 * uncovered segment collapses onto its coverage-side vertex, glued to the
 * entry owning that boundary.
 */
function buildMorphEntries(
        gA: Segment[],
        gB: Segment[],
        loopA: number[][][],
        loopB: number[][][],
        weights?: Partial<PathCostWeights>): MorphEntry[] {

    const fullWeights: PathCostWeights = { ...defaultPathWeights, ...weights };

    // Continuation leftovers are never matched (the builder can't express
    // covered continuations) - they retract via the usual piece-stub
    // semantics.
    const trunk = matchSegTrees(gA, gB, loopA, loopB, fullWeights);
    recordPathMatch(trunk, gA, gB, loopA, loopB, fullWeights);

    // The sleeves walk the outline in its global direction - the glyph
    // loop gives a reliable winding for the cap arcs.
    const capSign = getShapeArea(loopA) < 0 ? -1 : 1;

    const unitA = getUnit$(loopA);
    const unitB = getUnit$(loopB);

    const entries: MorphEntry[] = [];

    /**
     * covered segment → owning entry index (per side; placeTopology adds
     * placed segments as glue hosts for chained uncovered neighbors)
     */
    const owner1 = new Map<Segment, number>();
    const owner2 = new Map<Segment, number>();

    // Every segment covered by SOME matched route (per tree) - the rest
    // retracts/grows as per-segment collapsed entries.
    const covered1 = coveredSegsOf(trunk, 'a');
    const covered2 = coveredSegsOf(trunk, 'b');

    let pairIdx = 0;

    buildPair(trunk);

    // Whatever no matched route covers collapses onto its coverage-side
    // vertex, closest-to-coverage first.
    placeTopology(gA, covered1, owner1, 'a',
        'red thin35 nofill', capSign, entries);
    placeTopology(gB, covered2, owner2, 'b',
        'green thin35 nofill', capSign, entries);

    return entries;


    /**
     * Builds the entry for one matched path pair, then recursively its
     * matched children's entries (glued onto this one). Returns the index.
     *
     * @param glueOf for a child pair: its glue onto the parent, given the
     * child's own (resampled) skeletons
     */
    function buildPair(
            mp: SegMatchedPair,
            glueOf?: (skelPssA: number[][][], skelPssB: number[][][]) => Glue
            ): number {

        const i = pairIdx++;
        const idx = entries.length;

        const gA = composeRouteGeom(mp.routeA);
        const gB = composeRouteGeom(mp.routeB);

        for (const st of mp.routeA) { owner1.set(st.seg, idx); }
        for (const st of mp.routeB) { owner2.set(st.seg, idx); }

        // Feature anchors: ALL matched child forks along the paths (incl.
        // absorbed stretches - the matcher pooled them).
        const LA = lenOf$(gA.bz);
        const LB = lenOf$(gB.bz);

        const matchOps = mp.ops.filter(
            op => op.type === 'match');
        const anchors: AnchorPair[] = matchOps.map(op => ({
            uA: clamp(op.a.dist / LA, 0, 1),
            uB: clamp(op.b.dist / LB, 0, 1)
        }));

        // Non-linear (feature-warped) correspondence along the skeleton.
        const al = alignBranches(
            gA.bz, gA.rd, gB.bz, gB.rd, anchors, unitA, unitB
        );

        const mA = resampleAt(gA.bz, gA.rd, al.usA);
        const mB = resampleAt(gB.bz, gB.rd, al.usB);

        // Boundary anchored to the maximal disks, shape lerped on top.
        const sides = buildSleeveSides(
            { edges: gA.edges, knots: calcSkelCumKnots(gA.bz),
              us: al.usA, bz: mA.beziers, radii: mA.radii },
            { edges: gB.edges, knots: calcSkelCumKnots(gB.bz),
              us: al.usB, bz: mB.beziers, radii: mB.radii }
        );

        const bndA = boundaries(mA.beziers);
        const bndB = boundaries(mB.beziers);

        entries.push({
            skelPssA: mA.beziers,
            skelPssB: mB.beziers,
            ra: mA.radii,
            rb: mB.radii,
            sleeveOut: sides.out,
            sleeveBack: sides.back,
            capSign,
            classes: `${matchColors[i % matchColors.length]} thin35 nofill`,
            ...(glueOf !== undefined
                ? { glue: glueOf(mA.beziers, mB.beziers) }
                : {}
            )
        });

        // Children: build each matched sub-pair glued to this entry - at the
        // aligned fork anchor when kept, else at the per-frame nearest
        // boundary to the child's junction.
        matchOps.forEach((op, n) => {
            const k = al.anchorIdx[n];
            buildPair(op.sub, (skelPssA, skelPssB) => k >= 0
                ? { e: idx, k1: k, k2: k }
                : {
                    e: idx,
                    k1: nearestIdx(bndA, getLastP(skelPssA)),
                    k2: nearestIdx(bndB, getLastP(skelPssB))
                }
            );
        });

        return idx;
    }
}


/** Every segment covered by some matched route, one tree's side. */
function coveredSegsOf(
        trunk: SegMatchedPair,
        side: 'a' | 'b'): Set<Segment> {

    return new Set(pairsOf(trunk)
        .flatMap(({ mp }) => side === 'a' ? mp.routeA : mp.routeB)
        .map(st => st.seg));
}


export { buildMorphEntries, coveredSegsOf }
