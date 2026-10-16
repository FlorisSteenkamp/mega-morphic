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
import { alignSeq } from '../../match-paths/align-seq.js';
import { lenOfRoute$ } from '../len-of.js';
import { childrenOf } from './children-of.js';
import { subDtwOf } from './sub-dtw-of.js';
import { reverseRoute } from './reverse-route.js';
import {
    posCostOf, angleCostOf, dropCostOf, terminalGated, seqOf
} from './child-costs.js';
import { CAND_MARGIN, MAX_RECURSE_CANDS, SUB_CHEAP_CANDS } from './consts.js';


/** builds the pair node for a matched route pair, recursively */
function buildPair(
        cheapChildCost_: CalcCheapChildCost,
        gA: Segment[],
        gB: Segment[],
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        swayW: number) {

    const posCost_ = posCostOf(unitA, unitB, weights);
    const angleCost = angleCostOf(weights);
    const drop = dropCostOf(weights);

    return _buildPair;

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
                    const rA = reverseRoute(
                        routeSegments(a.segs, a.attachV, c.endA));
                    const rB = reverseRoute(
                        routeSegments(b.segs, b.attachV, c.endB));
                    return { c, rA, rB,
                        rank: c.totalCost + c.swayCost + cheapChildCost_(
                            childrenOf(a.segs, rA, unitA),
                            childrenOf(b.segs, rB, unitB),
                            lenOfRoute$(rA), lenOfRoute$(rB)) };
                });
            leaders.sort((x, y) => x.rank - y.rank);
            const limit = leaders[0].rank + CAND_MARGIN;
            let best: SegMatchedPair | undefined;
            let bestSel = Infinity;
            let evals = 0;
            for (const l of leaders) {
                if (l.rank > limit || evals >= MAX_RECURSE_CANDS) { break; }
                evals++;
                const pair = _buildPair(
                    a.segs, l.rA, b.segs, l.rB, l.c.shapeCost);
                const sel = pair.cost + l.c.swayCost;
                if (sel < bestSel) {
                    bestSel = sel;
                    best = pair;
                }
            }
            return best!;
        };

        const posCost = (a: SegChild, b: SegChild): number =>
            posCost_(a, b, lenRA, lenRB);

        const matchCost = (a: SegChild, b: SegChild): number => {
            if (terminalGated(a, b)) { return Infinity; }
            const dtw = subOf(a, b);
            // + measured warp sway: a child pairing that would visibly
            // rotate loses to a drop / a same-orientation partner
            return posCost(a, b) + angleCost(a, b) +
                dtw.totalCost + dtw.swayCost;
        };

        const ops: SegOp[] = [];
        const dp: SegDp[] | undefined =
            typeof _debug_ !== 'undefined' ? [] : undefined;
        let cost = shapeCost;

        for (const side of [1, -1] as const) {
            const As = seqOf(chA, side);
            const Bs = seqOf(chB, side);

            const r = alignSeq(As, Bs, matchCost, drop, drop);
            dp?.push({ side, D: r.D, as: As, bs: Bs, ops: r.ops });

            for (const op of r.ops) {
                if (op.type === 'match') {
                    const subPair = evalBest(op.a, op.b);
                    cost += posCost(op.a, op.b) +
                        angleCost(op.a, op.b) +
                        subPair.cost;
                    ops.push({
                        type: 'match', a: op.a, b: op.b, sub: subPair });
                } else if (op.type === 'delete') {
                    cost += drop(op.a);
                    ops.push(op);
                } else {
                    cost += drop(op.b);
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
