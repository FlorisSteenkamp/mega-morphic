declare var _debug_: Debug; 
import type { Debug } from '../../debug/debug.js';
import type { MorphEntry, MutableMorphEntry } from '../morph-entry.js';
import type { AnchorPair } from '../align-branches.js';
import type { MatchedPath } from '../match-paths/matched-path.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { Segment } from '../segment-graph/segment.js';
import type { SegGraph } from '../segment-graph/seg-graph.js';
import { getShapeArea } from 'flo-boolean';
import { matchPathsViaSegments } from '../segment-graph/match-paths-via-segments.js';
import { composeRouteGeom } from '../segment-graph/compose-segs.js';
import { alignBranches, resampleAt } from '../align-branches.js';
import { buildSleeveSides, skeletonKnots } from '../anchored-sleeves.js';
import { getLastP } from '../fs/get-last-p.js';
import { clamp } from '../../utils/clamp.js';
import { matchColors } from '../../page/events/match-colors.js';
import { nearestIdx } from '../nearest-idx.js';
import { placeTopology } from '../place-topology.js';
import { getUnit$ } from '../segment-graph/get-unit.js';
import { lenOf$ } from '../segment-graph/len-of.js';


/**
 * A matched feature (fork) position in both frames, for visualization.
 * 
 * * Crosses = aligned fork anchors;
 * * dots = plain attachment points (fallback-glued matched children, topo/stub retraction targets)
 */
interface FeatureMark {
    readonly pA?: number[];
    readonly pB?: number[];
    readonly classes: string;
    readonly dot?: boolean;
    /** the mark's home on the DRAWN entries: boundary indices k1 (t=0) to
     *  k2 (t=1) of entry `e` - lets the mark ride the morph */
    readonly at?: { e: number; k1: number; k2: number };
}


/**
 * Matches the two segment graphs route-wise (DTW alignability as the
 * matching metric) and builds the full set of morph entries: each matched
 * route pair becomes one feature-aligned entry, matched child forks along
 * the whole route are alignment anchors and glue points, and every
 * uncovered segment collapses onto its coverage-side vertex, glued to the
 * entry owning that boundary.
 */
function buildMorphEntries(
        gA: SegGraph,
        gB: SegGraph,
        marks: FeatureMark[],
        weights?: Partial<PathCostWeights>):
        MorphEntry[] {

    const pm = matchPathsViaSegments(gA, gB, { weights });

    // The morph arrays only exist when morph debugging is enabled (other
    // debug configs, e.g. flo-boolean-only in tests, lack them).
    if (typeof _debug_ !== 'undefined' &&
        _debug_.elems?.pathMatchResult !== undefined) {
        // Keep only the LATEST result - readers use [0]/at(-1) and stale
        // entries (whole graphs) would otherwise accumulate.
        _debug_.elems.pathMatchResult.length = 0;
        _debug_.elems.pathMatchResult.push(pm);
    }

    // The sleeves walk the outline in its global direction - the glyph
    // loop gives a reliable winding for the cap arcs.
    const capSign = getShapeArea(gA.loop) < 0 ? -1 : 1;

    const unitA = getUnit$(gA.loop);
    const unitB = getUnit$(gB.loop);

    const entries: MutableMorphEntry[] = [];

    /** per entry: its resampled segment boundary points, per side */
    const bnds: { a?: number[][]; b?: number[][] }[] = [];

    /**
     * covered segment → owning entry index (per side; placeTopology adds
     * placed segments as glue hosts for chained uncovered neighbors)
     */
    const owner1 = new Map<Segment, number>();
    const owner2 = new Map<Segment, number>();

    // Every segment covered by SOME matched route (per tree) - the rest
    // retracts/grows as per-segment collapsed entries.
    const covered1 = coveredSegsOf(pm.trunk, 'a');
    const covered2 = coveredSegsOf(pm.trunk, 'b');

    let pairIdx = 0;

    buildPair(pm.trunk);

    // Whatever no matched route covers collapses onto its coverage-side
    // vertex, closest-to-coverage first.
    placeTopology(gA, covered1, owner1, 'a',
        'red thin35 nofill', capSign, bnds, entries, marks);
    placeTopology(gB, covered2, owner2, 'b',
        'green thin35 nofill', capSign, bnds, entries, marks);

    return entries as MorphEntry[];


    /**
     * Builds the entry for one matched path pair, then recursively its
     * matched children's entries (glued onto this one). Returns the index.
     */
    function buildPair(mp: MatchedPath): number {

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

        const matchOps = mp.children.filter(
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
            { edges: gA.edges, knots: skeletonKnots(gA.bz),
              us: al.usA, bz: mA.beziers, radii: mA.radii },
            { edges: gB.edges, knots: skeletonKnots(gB.bz),
              us: al.usB, bz: mB.beziers, radii: mB.radii }
        );

        const bndA = boundaries(mA.beziers);
        const bndB = boundaries(mB.beziers);
        bnds.push({ a: bndA, b: bndB });

        entries.push({
            skelPssA: mA.beziers,
            skelPssB: mB.beziers,
            ra: mA.radii,
            rb: mB.radii,
            us: al.usA,
            sleeveOut: sides.out,
            sleeveBack: sides.back,
            capSign,
            classes: `${matchColors[i % matchColors.length]} thin35 nofill`,
        });

        // Children: build each matched sub-pair and glue it to this entry -
        // at the aligned fork anchor when kept, else at the per-frame
        // nearest boundary.
        matchOps.forEach((op, n) => {
            const childIdx = buildPair(op.sub);

            const k = al.anchorIdx[n];
            if (k >= 0) {
                entries[childIdx].glue = { e1: idx, k1: k, e2: idx, k2: k };
                if (marks !== undefined) {
                    marks.push({
                        pA: bndA[k],
                        pB: bndB[k],
                        classes: `${matchColors[
                            childIdx % matchColors.length]} thin20 nofill`,
                        at: { e: idx, k1: k, k2: k }
                    });
                }
            } else {
                const k1 = nearestIdx(bndA, getLastP(entries[childIdx].skelPssA));
                const k2 = nearestIdx(bndB, getLastP(entries[childIdx].skelPssB));
                entries[childIdx].glue = { e1: idx, k1, e2: idx, k2 };
                marks?.push({
                    pA: bndA[k1],
                    pB: bndB[k2],
                    classes: 'gray nostroke',
                    dot: true,
                    at: { e: idx, k1, k2 }
                });
            }
        });

        return idx;
    }
}


/** Every segment covered by some matched route, one tree's side. */
function coveredSegsOf(
        trunk: MatchedPath,
        side: 'a' | 'b'): Set<Segment> {

    const out = new Set<Segment>();
    const walk = (mp: MatchedPath): void => {
        for (const st of side === 'a' ? mp.routeA : mp.routeB) {
            out.add(st.seg);
        }
        for (const op of mp.children) {
            if (op.type === 'match') { walk(op.sub); }
        }
    };
    walk(trunk);
    return out;
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]) {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


export { buildMorphEntries, coveredSegsOf }
export type { FeatureMark }
