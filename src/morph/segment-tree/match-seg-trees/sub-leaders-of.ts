import type { RouteStep } from '../segment.js';
import type { ProductDtwResult, ProductDtwResult_Candidate } from '../product-dtw.js';
import type { SegChild } from './seg-child.js';
import type { CalcCheapChildCost } from './cheap-child-cost.js';
import { routeSegments } from '../route-segments.js';
import { childrenOf } from './children-of.js';
import { outlineLenOf } from './outline-len-of.js';
import { SUB_CHEAP_CANDS } from './consts.js';


/** a sub-DTW route candidate of a child pair, with its routes and rank */
interface SubLeader {
    readonly c: ProductDtwResult_Candidate;
    /** the route in A, tip → junction */
    readonly rA: RouteStep[];
    /** the route in B, tip → junction */
    readonly rB: RouteStep[];
    /** shape + sway + the cheap estimate of the routes' children */
    readonly rank: number;
}


/**
 * Returns the leading route candidates of a child pair's sub-DTW, ranked
 * (best first) by an estimate of their full recursive cost.
 *
 * * rank = the routes' own shape cost + measured warp sway + the cheap
 *   estimate of aligning the children hanging off the two routes
 *   (`cheapChildCost`)
 *
 * * the material the routes leave uncovered is priced only through those
 *   children (matched or dropped), never also as the DTW's uncovered
 *   material (`totalCost` would charge it a second time, as if dropped)
 *
 * @param dtw the child pair's pinned-start sub-DTW
 * @param a the child of A
 * @param b the child of B
 * @param unitA tree A's length normalization
 * @param unitB tree B's length normalization
 * @param cheapChildCost_ the cheap child-alignment estimate
 */
function subLeadersOf(
        dtw: ProductDtwResult,
        a: SegChild,
        b: SegChild,
        unitA: number,
        unitB: number,
        cheapChildCost_: CalcCheapChildCost): SubLeader[] {

    const leaders = dtw.candidates.slice(0, SUB_CHEAP_CANDS).map(c => {
        // tip → junction (the DTW runs junction → tip)
        const rA = routeSegments(a.segs, c.endA, a.attachV);
        const rB = routeSegments(b.segs, c.endB, b.attachV);
        const cheap = cheapChildCost_(
            childrenOf(a.segs, rA, unitA),
            childrenOf(b.segs, rB, unitB),
            outlineLenOf(rA),
            outlineLenOf(rB)
        );

        return { c, rA, rB, rank: c.shapeCost + c.swayCost + cheap };
    });

    return leaders.sort((x, y) => x.rank - y.rank);
}


export { subLeadersOf }
export type { SubLeader }
