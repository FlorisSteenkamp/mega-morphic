import type { PathAlignDebug } from '../morph/match-paths/path-align-debug.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { RouteStep } from '../morph/segment-tree/segment.js';
import type { SampledSegGraph } from '../morph/segment-tree/sampled-seg-graph.js';
import type { DtwTraceStep } from '../morph/segment-tree/product-dtw.js';
import { traceSingleDtw } from '../morph/segment-tree/product-dtw.js';
import { sampleSegTree } from '../morph/segment-tree/sample-seg-tree.js';
import { sampleCountFor } from '../morph/segment-tree/match-seg-trees/sub-dtw-of.js';
import { routeEndsOf } from '../morph/segment-tree/match-seg-trees/outline-len-of.js';
import { composeRouteGeom } from '../morph/segment-tree/compose-segs.js';
import { lenOfSegs$ } from '../morph/segment-tree/len-of.js';
import { geomOf$ } from '../morph/segment-tree/geom-of.js';


/**
 * * **Debug only**
 *
 * Returns the matcher's own alignment of a matched route pair, for the
 * DTW views: the path of the pinned-start product DTW the matcher prices
 * a route pair with (`routePairCostsOf`) - same sampling, objective (shape
 * minus the coverage reward, gaps priced by material) and sway tie-breaks
 * - traced back (`traceSingleDtw`) - `undefined` if it can't be traced.
 *
 * * the trunk's routes are aligned from their starts, a child pair's from
 *   their ends (its junctions - the routes run tip → junction, the sub-DTW
 *   junction → tip); the steps are returned in route order either way
 *
 * * a pair kept from a staggered match's coarse SAT was priced on the
 *   coarse trees - its path here is on the routes as refined
 *
 * @param routeA the route in A
 * @param routeB the route in B
 * @param unitA tree A's length normalization
 * @param unitB tree B's length normalization
 * @param δA tree A's trunk-level sample spacing
 * @param δB tree B's trunk-level sample spacing
 * @param weights the weights the pair was aligned with (a child pair's:
 * `calcSubWeights`)
 * @param sway the local-sway measurement factor
 * @param rotB the rotation of B's directions into A's frame (a child
 * pair's parent-frame difference, `0` for the trunk)
 * @param isChild `true` for a child pair (aligned from its junctions)
 */
function alignOfRoutes(
        routeA: RouteStep[],
        routeB: RouteStep[],
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        sway: number,
        rotB: number,
        isChild: boolean): PathAlignDebug | undefined {

    const segsA = routeA.map(st => st.seg);
    const segsB = routeB.map(st => st.seg);
    const lenA = lenOfSegs$(segsA);
    const lenB = lenOfSegs$(segsB);
    if (!(lenA > 0) || !(lenB > 0)) { return undefined; }

    const [startA, endA] = routeEndsOf(routeA);
    const [startB, endB] = routeEndsOf(routeB);
    const rootA = isChild ? endA : startA;
    const rootB = isChild ? endB : startB;

    const ssgA = sampleSegTree(segsA, unitA, sampleCountFor(lenA, δA), rootA);
    const ssgB = sampleSegTree(segsB, unitB, sampleCountFor(lenB, δB), rootB);
    if (ssgA.starts.length !== 1 || ssgB.starts.length !== 1) {
        return undefined;
    }
    // φ only feeds the sway measurement
    const ssgBInA = { ...ssgB, φ: ssgB.φ.map(φ => φ + rotB) };

    const trace = traceSingleDtw(
        ssgA, ssgBInA, weights, sway,
        isChild ? startA : endA,
        isChild ? startB : endB);
    if (trace === undefined) { return undefined; }

    const path = isChild ? toRouteOrder(trace) : trace;

    const usA = calcSampleUs(routeA, ssgA, path.map(s => s.a));
    const usB = calcSampleUs(routeB, ssgB, path.map(s => s.b));

    const { skelPss: skelPssA, radii: radiiA } = composeRouteGeom(routeA);
    const { skelPss: skelPssB, radii: radiiB } = composeRouteGeom(routeB);

    return {
        usA: usA.us, usB: usB.us,
        skelPssA, skelPssB,
        radiiA, radiiB,
        steps: path.map(({ a, b, state, cost }) => ({
            i: usA.idx.get(a)!, j: usB.idx.get(b)!, state, cost
        }))
    };
}


/**
 * Returns a traced path walked the other way: each move keeps the kind
 * (diagonal or gap) and cost it had, now on the state it arrives at.
 */
function toRouteOrder(
        trace: DtwTraceStep[]): DtwTraceStep[] {

    const n = trace.length;

    return trace.map((s, k) => {
        const cell = trace[n - 1 - k];
        if (k === 0) { return { ...cell, state: 0 as const }; }

        const { state, cost } = trace[n - k];

        return { a: cell.a, b: cell.b, state, cost };
    });
}


/**
 * Returns the route-order index of each sample the path visits on one side
 * (`idx`) and the samples' positions as fractions of the route's length
 * (`us`, by index).
 *
 * * the path is monotone on each side and consumes every sample of the
 *   route (both its ends are pinned), so its distinct samples in visiting
 *   order are the route's samples in order
 *
 * @param route the route (its steps in `g`'s order - the sampled segments)
 * @param ssg the route's sampled graph
 * @param ids the samples the path visits, in order (with repeats)
 */
function calcSampleUs(
        route: RouteStep[],
        ssg: SampledSegGraph,
        ids: number[]): { idx: Map<number, number>; us: number[] } {

    const lens = route.map(st => geomOf$(st.seg).skelLen);
    const total = lens.reduce((s, l) => s + l, 0);
    const cum = [0];
    for (const l of lens) { cum.push(cum[cum.length - 1] + l); }

    const idx = new Map<number, number>();
    const us: number[] = [];
    for (const id of ids) {
        if (idx.has(id)) { continue; }

        const s = ssg.seg[id];
        const f = route[s].reversed ? 1 - ssg.pos[id] : ssg.pos[id];
        idx.set(id, us.length);
        us.push((cum[s] + f*lens[s])/total);
    }

    return { idx, us };
}


export { alignOfRoutes }
