declare var _debug_: Debug;
import type { Debug } from '../../../debug/debug.js';
import type { Segment, RouteStep } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { SegOp } from './seg-op.js';
import type { SegDp } from './seg-dp.js';
import type { SegMatchedPair } from './seg-matched-pair.js';
import type { ProductDtwResult } from '../product-dtw.js';
import type { CalcCheapChildCost } from './cheap-child-cost.js';
import { routeSegments } from '../route-segments.js';
import { lenOfRoute$, lenOfSegs$ } from '../len-of.js';
import { childrenOf } from './children-of.js';
import { subDtwOf } from './sub-dtw-of.js';
import {
    calcChildPosCost, calcAngleCost, calcDropCost, isTerminalGated
} from './child-costs.js';
import { pickBest } from './pick-best.js';
import { alignSides } from './align-sides.js';
import {
    MAX_RECURSE_CANDS, SUB_CHEAP_CANDS, TARGET_SAMPLES
} from './consts.js';


/**
 * Returns `_buildPair`, which builds the match-tree node (`SegMatchedPair`)
 * of a matched route pair, recursing into its matched children.
 *
 * * binds the per-match context shared by every level of the recursion
 * * see `_buildPair` for what a single call does
 *
 * @param cheapChildCost_ the cheap child-consistency estimate (used to
 * re-rank sub-DTW route candidates before the costly recursion)
 * @param gA tree A's segments (sets its trunk-level sample spacing)
 * @param gB tree B's segments
 * @param unitA tree A's length normalization
 * @param unitB tree B's length normalization
 * @param weights the path cost weights
 * @param swayW local-sway measurement factor (measured along every DTW
 * warp; used for ranking/selection only, never added to `cost`)
 */
function buildPair(
        cheapChildCost_: CalcCheapChildCost,
        gA: Segment[],
        gB: Segment[],
        unitA: number,
        unitB: number,
        weights: PathCostWeights,
        swayW: number) {

    // trunk-level sample spacing of trees (as `matchSegTrees` samples the
    // trunk) - sets the sub-DTW sample counts, so subtrees are sampled as
    // densely as the trunk
    const δA = lenOfSegs$(gA) / TARGET_SAMPLES;
    const δB = lenOfSegs$(gB) / TARGET_SAMPLES;

    const calcChildPosCost_ = calcChildPosCost(unitA, unitB, weights);
    const calcAngleCost_ = calcAngleCost(weights);
    const calcDropCost_ = calcDropCost(weights);

    return _buildPair;

    /**
     * The match-tree node of the route pair `rA` (in `scopeA`) ↔ `rB` (in
     * `scopeB`), with its children matched recursively:
     *
     * * finds the children (subtrees) hanging off each route within its scope
     * * per side of the routes (`1`, then `-1`), aligns the two children
     *   sequences (Needleman-Wunsch, `alignSeq`):
     *   * match: position + angle + the pair's pinned-start sub-DTW cost +
     *     its measured warp sway (`Infinity` for a terminal↔regular pair)
     *   * delete / insert: the dropped child's drop cost
     * * each matched child pair recurses (`evalBest`): the sub-DTW's route
     *   candidates are re-ranked by DP cost + sway + the cheap child
     *   estimate, and the leaders within `CAND_MARGIN` of the best (at most
     *   `MAX_RECURSE_CANDS`) are fully built; the one with the lowest
     *   recursive cost + sway wins
     * * child routes run tip → junction (from the sub-DTW's end vertex to
     *   the child's attach vertex)
     * * `cost` = `shapeCost` + per matched child: position + angle + its
     *   recursive `cost`; per dropped child: its drop cost (sway only ever
     *   selects, it is never added)
     * * when `_debug_` is active, the per-side alignment DPs are attached
     *   as `dp`
     *
     * @param scopeA the segments of A the children are taken from
     * @param rA the route in A
     * @param scopeB the segments of B the children are taken from
     * @param rB the route in B
     * @param shapeCost the routes' own (DTW) shape cost
     */
    function _buildPair(
            scopeA: Segment[],
            rA: RouteStep[],
            scopeB: Segment[],
            rB: RouteStep[],
            shapeCost: number): SegMatchedPair {

        const chA = childrenOf(scopeA, rA, unitA);
        const chB = childrenOf(scopeB, rB, unitB);
        const lenRA = lenOfRoute$(rA);
        const lenRB = lenOfRoute$(rB);

        // pinned-start sub-DTW per candidate pair, memoized (totalCost for
        // alignment decisions; trees + candidates for recursive evaluation)
        const subs = new Map<SegChild, Map<SegChild, ProductDtwResult>>();
        const subOf = (a: SegChild, b: SegChild) =>
            subs.getOrInsertComputed(a, () => new Map())
                .getOrInsertComputed(b, () =>
                    subDtwOf(gA, gB, unitA, unitB, δA, δB, weights, swayW, a, b));

        /** best sub-pair over the DTW's route candidates by RECURSIVE cost
         *  (DP leaders first re-ranked by the cheap child estimate;
         *  measured warp sway rides every rank/selection) */
        function evalBest(a: SegChild, b: SegChild): SegMatchedPair {
            const dtw = subOf(a, b);
            const leaders = dtw.candidates.slice(0, SUB_CHEAP_CANDS)
                .map(c => {
                    // tip → junction (the DTW runs junction → tip)
                    const rA = routeSegments(a.segs, c.endA, a.attachV);
                    const rB = routeSegments(b.segs, c.endB, b.attachV);
                    return { c, rA, rB,
                        rank: c.totalCost + c.swayCost + cheapChildCost_(
                            childrenOf(a.segs, rA, unitA),
                            childrenOf(b.segs, rB, unitB),
                            lenOfRoute$(rA), lenOfRoute$(rB)) };
                });
            leaders.sort((x, y) => x.rank - y.rank);

            return pickBest(leaders, MAX_RECURSE_CANDS,
                l => _buildPair(a.segs, l.rA, b.segs, l.rB, l.c.shapeCost));
        };

        const matchCost = (a: SegChild, b: SegChild): number => {
            if (isTerminalGated(a, b)) { return Infinity; }
            const dtw = subOf(a, b);
            // + measured warp sway: a child pairing that would visibly
            // rotate loses to a drop / a same-orientation partner
            return calcChildPosCost_(a, b, lenRA, lenRB) + calcAngleCost_(a, b) +
                dtw.totalCost + dtw.swayCost;
        };

        const ops: SegOp[] = [];
        const dp: SegDp[] | undefined =
            typeof _debug_ !== 'undefined' ? [] : undefined;
        let cost = shapeCost;

        for (const { side, as, bs, D, ops: sideOps } of
                alignSides(chA, chB, matchCost, calcDropCost_)) {

            dp?.push({ side, D, as, bs, ops: sideOps });

            for (const op of sideOps) {
                if (op.type === 'match') {
                    const subPair = evalBest(op.a, op.b);
                    cost += calcChildPosCost_(op.a, op.b, lenRA, lenRB) +
                        calcAngleCost_(op.a, op.b) +
                        subPair.cost;
                    ops.push({
                        type: 'match', a: op.a, b: op.b, sub: subPair });
                } else if (op.type === 'delete') {
                    cost += calcDropCost_(op.a);
                    ops.push(op);
                } else {
                    cost += calcDropCost_(op.b);
                    ops.push(op);
                }
            }
        }

        return {
            routeA: rA, routeB: rB, shapeCost, cost, ops,
            ...(dp !== undefined ? { dp } : {})
        };
    }
}


export { buildPair }
