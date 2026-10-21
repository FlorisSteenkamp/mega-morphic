declare var _debug_: Debug;
import type { Debug } from '../../../debug/debug.js';
import type { Segment, RouteStep } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { SegOp } from './seg-op.js';
import type { SegDp } from './seg-dp.js';
import type { SegMatchedPair } from './seg-matched-pair.js';
import type { CalcCheapChildCost } from './cheap-child-cost.js';
import type { SubLeader } from './sub-leaders-of.js';
import type { Circle } from 'flo-mat';
import type { RouteWarp } from './route-warp-of.js';
import { routeEndsOf } from './outline-len-of.js';
import { subLeadersOf } from './sub-leaders-of.js';
import { lenOfSegs$, lenOfRoute$ } from '../len-of.js';
import { childrenOf } from './children-of.js';
import { subDtwOf } from './sub-dtw-of.js';
import {
    calcWarpPosCost, calcAngleCost, calcSizeFactor, calcDropCost
} from './child-costs.js';
import { pickBest } from './pick-best.js';
import { scoreOf } from './score-of.js';
import { alignOutline } from './align-outline.js';
import { routeWarpOf } from './route-warp-of.js';
import { routeFeaturesOf } from './route-features-of.js';
import { endVariantsOf } from './end-variants-of.js';
import { routePairCostsOf } from './route-pair-costs-of.js';
import { routeSegments } from '../route-segments.js';
import { MAX_RECURSE_CANDS, TARGET_SAMPLES } from './consts.js';


/** a child pair's sub-route leaders, and how many get a full evaluation */
interface Leaders {
    readonly leaders: SubLeader[];
    readonly evals: number;
}


/**
 * Returns the builders of the match tree, bound to the per-match context
 * shared by every level of the recursion:
 *
 * * `pairOf` builds the match-tree node (`SegMatchedPair`) of a matched
 *   route pair, recursing into its matched children (see `_buildPair`)
 *
 * * `evalBest` returns the best fully built sub-pair of a child pair
 *
 * @param cheapChildCost_ the cheap child-consistency estimate (used to
 * rank sub-DTW route candidates before the costly recursion)
 * @param gA tree A's segments (sets its trunk-level sample spacing)
 * @param gB tree B's segments
 * @param unitA tree A's length normalization
 * @param unitB tree B's length normalization
 * @param weights the path cost weights
 * @param swayW local-sway measurement factor (measured along every DTW
 * warp; part of every decision, never added to `cost`)
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

    const calcWarpPosCost_ = calcWarpPosCost(weights);
    const calcAngleCost_ = calcAngleCost(weights);
    const calcSizeFactor_ = calcSizeFactor(weights);
    const calcDropCost_ = calcDropCost(weights);

    // memoized for the whole match, keyed by what the results depend on
    // (`calcChildPairKey`, `calcRoutePairKey`) - not by the child objects,
    // which `childrenOf` makes anew for every route: the same subtree pair
    // recurs under every parent route (trunk candidate, variant, sub-route)
    // that reaches it
    const leadersMemo = new Map<string, Leaders>();
    const bestMemo = new Map<string, SegMatchedPair>();
    const routePairCostsMemo =
        new Map<string, { shapeCost: number; swayCost: number } | undefined>();
    const warpMemo = new Map<string, RouteWarp>();

    return { pairOf: _buildPair, evalBest };


    /**
     * Returns the pinned-start sub-DTW's route leaders of the child pair,
     * ranked by estimated recursive cost, and how many get a full
     * evaluation (memoized).
     *
     * * the first `MAX_RECURSE_CANDS` come with their tip-end variants
     *   (`endVariantsOf` - fork against leaf across a short tip), and are
     *   the ones evaluated in full
     */
    function leadersOf(
            a: SegChild,
            b: SegChild): Leaders {

        return leadersMemo.getOrInsertComputed(calcChildPairKey(a, b), () => {
                const sizeFactor = calcSizeFactor_(a, b);
                const ls = subLeadersOf(
                    subDtwOf(gA, gB, unitA, unitB, δA, δB, weights, swayW, a, b),
                    a, b, unitA, unitB, cheapChildCost_, sizeFactor);

                // variants priced junction → tip, as the sub-DTW runs, in
                // the parent's frame
                const rotB = a.routeDir - b.routeDir;
                const head = ls.slice(0, MAX_RECURSE_CANDS).flatMap(l =>
                    endVariantsOf(l.c, gA, gB, (startA, endA, startB, endB) =>
                        routePairCostsMemo.getOrInsertComputed(
                            calcRoutePairKey(startA, endA, startB, endB) +
                                `|${rotB}`,
                            () => routePairCostsOf(
                                routeSegments(a.segs, startA, endA),
                                routeSegments(b.segs, startB, endB),
                                unitA, unitB, δA, δB, weights, swayW, rotB))
                    ).map(c => c === l.c ? l : {
                        c,
                        // tip → junction
                        rA: routeSegments(a.segs, c.endA, c.startA),
                        rB: routeSegments(b.segs, c.endB, c.startB),
                        rank: l.rank
                    }));

                return {
                    leaders: [...head, ...ls.slice(MAX_RECURSE_CANDS)],
                    evals: head.length
                };
            });
    }


    /**
     * Returns the best sub-pair of the child pair over its sub-route leaders
     * by `scoreOf` (memoized - the full recursion).
     */
    function evalBest(
            a: SegChild,
            b: SegChild): SegMatchedPair {

        const { leaders, evals } = leadersOf(a, b);

        return bestMemo.getOrInsertComputed(calcChildPairKey(a, b), () =>
            pickBest(
                leaders, evals,
                l => _buildPair(
                    a.segs, l.rA, b.segs, l.rB,
                    l.c.shapeCost, calcSizeFactor_(a, b)*l.c.swayCost)));
    }


    /**
     * Returns `true` if the child pair's best sub-pair has been built.
     */
    function isBuilt(
            a: SegChild,
            b: SegChild): boolean {

        return bestMemo.has(calcChildPairKey(a, b));
    }


    /**
     * Returns the correspondence of the route pair (memoized by its ends).
     */
    function warpOf(
            rA: RouteStep[],
            rB: RouteStep[]): RouteWarp {

        const [startA, endA] = routeEndsOf(rA);
        const [startB, endB] = routeEndsOf(rB);

        return warpMemo.getOrInsertComputed(
            calcRoutePairKey(startA, endA, startB, endB),
            () => routeWarpOf(rA, rB, unitA, unitB));
    }


    /**
     * The match-tree node of the route pair `rA` (in `scopeA`) ↔ `rB` (in
     * `scopeB`), with its children matched recursively:
     *
     * * finds the children (subtrees) hanging off each route within its scope
     *
     * * aligns the two children sequences around the routes' outlines
     *   (cyclic Needleman-Wunsch, `alignOutline`):
     *   * match: position + angle + the `scoreOf` of the pair's best fully
     *     built sub-pair (`evalBest`)
     *   * position: through the routes' profile correspondence (`warp`),
     *     in units of the local feature spacing (`calcWarpPosCost`) - a
     *     child landing on the neighbouring fork costs about as much as one
     *     slid within its stretch costs little
     *   * delete / insert: the dropped child's drop cost
     *
     * * the alignment is exact but lazy: a pair not yet built is priced at a
     *   lower bound of its score (`calcScoreFloor`), the alignment is
     *   rerun after building every match it picked that was still unbuilt,
     *   until all its matches are built - as the bounds never overestimate,
     *   the result is optimal for the fully built scores, while building
     *   only pairs that were picked at some point
     *
     * * a match is skipped (`Infinity`) when its position + angle alone
     *   already cost as much as dropping both children - it can never beat
     *   delete + insert
     *
     * * child routes run tip → junction (from the sub-DTW's end vertex to
     *   the child's attach vertex)
     *
     * * `cost` = `shapeCost` + per matched child: position + angle + its
     *   recursive `cost`; per dropped child: its drop cost
     *
     * * `sway` = `swayCost`, the routes' own (never part of `cost`, but of
     *   every decision - each child's sway already priced its own match
     *   in this alignment, through its score)
     *
     * * when `_debug_` is active, the final alignment DP is attached as `dp`
     *
     * @param scopeA the segments of A the children are taken from
     * @param rA the route in A
     * @param scopeB the segments of B the children are taken from
     * @param rB the route in B
     * @param shapeCost the routes' own (DTW) shape cost
     * @param swayCost the routes' own measured warp sway
     */
    function _buildPair(
            scopeA: Segment[],
            rA: RouteStep[],
            scopeB: Segment[],
            rB: RouteStep[],
            shapeCost: number,
            swayCost: number): SegMatchedPair {

        const chA = childrenOf(scopeA, rA, unitA);
        const chB = childrenOf(scopeB, rB, unitB);
        const featsA = routeFeaturesOf(chA, lenOfRoute$(rA));
        const featsB = routeFeaturesOf(chB, lenOfRoute$(rB));

        // the routes' profile correspondence - only needed to place children
        const warp = chA.length > 0 && chB.length > 0
            ? warpOf(rA, rB)
            : undefined;

        /** position (through the warp) + angle, scaled by the pair's size */
        function calcPlaceCost(
                a: SegChild,
                b: SegChild): number {

            return calcSizeFactor_(a, b)*(
                calcWarpPosCost_(a, b, warp!, featsA, featsB) +
                calcAngleCost_(a, b)
            );
        }

        function matchCost(
                a: SegChild,
                b: SegChild): number {

            const placeCost = calcPlaceCost(a, b);
            // scores are never negative, so the match can't beat delete +
            // insert - skip the (costly) sub-DTW
            if (placeCost >= calcDropCost_(a) + calcDropCost_(b)) {
                return Infinity;
            }

            return placeCost + (isBuilt(a, b)
                ? scoreOf(evalBest(a, b))
                : calcScoreFloor(leadersOf(a, b).leaders, calcSizeFactor_(a, b)));
        }

        let aligned = alignOutline(chA, chB, matchCost, calcDropCost_);
        for (;;) {
            const unbuilt = aligned.ops.filter(
                op => op.type === 'match' && !isBuilt(op.a, op.b));
            if (unbuilt.length === 0) { break; }

            for (const op of unbuilt) {
                if (op.type === 'match') { evalBest(op.a, op.b); }
            }
            aligned = alignOutline(chA, chB, matchCost, calcDropCost_);
        }

        const ops: SegOp[] = [];
        let cost = shapeCost;

        for (const op of aligned.ops) {
            if (op.type === 'match') {
                const subPair = evalBest(op.a, op.b);
                cost += calcPlaceCost(op.a, op.b) + subPair.cost;
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

        const dp: SegDp | undefined = typeof _debug_ !== 'undefined'
            ? { D: aligned.D, as: aligned.as, bs: aligned.bs, ops: aligned.ops }
            : undefined;

        return {
            routeA: rA, routeB: rB, shapeCost, cost, sway: swayCost, ops,
            ...(dp !== undefined ? { dp } : {})
        };
    }
}


/** small numeric ids of objects, for memo keys */
const objIds = new WeakMap<object, number>();
let nextObjId = 0;


/**
 * Returns a small numeric id for the object, the same on every call.
 */
function idOf(
        o: object): number {

    let id = objIds.get(o);
    if (id === undefined) { id = nextObjId++; objIds.set(o, id); }

    return id;
}


/**
 * Returns the memo key of a child pair: everything its sub-match depends on.
 *
 * * a child's subtree is fixed by its attach vertex and entry segment (with
 *   the connectors of a merged junction between them), the rest (units,
 *   weights, spacing) by the match - only the parents' relative direction
 *   at the attach vertices (`routeDir`, the frame sway is measured in)
 *   remains
 *
 * * so the same subtree pair under different parent routes shares one key
 *   (`childrenOf` makes new child objects for every route)
 */
function calcChildPairKey(
        a: SegChild,
        b: SegChild): string {

    return `${idOf(a.attachV)},${idOf(a.entry)},` +
        `${idOf(b.attachV)},${idOf(b.entry)}|${a.routeDir - b.routeDir}`;
}


/**
 * Returns the memo key of a route pair given by its end vertices - in a
 * tree the route between two vertices is unique.
 */
function calcRoutePairKey(
        startA: Circle,
        endA: Circle,
        startB: Circle,
        endB: Circle): string {

    return `${idOf(startA)},${idOf(endA)},${idOf(startB)},${idOf(endB)}`;
}


/**
 * Returns a lower bound of the score (`scoreOf`) of a child pair's best
 * fully built sub-pair: the least shape + scaled sway among its sub-route
 * leaders.
 *
 * * the built sub-pair is one of these leaders, and its children's costs
 *   only add to its own shape
 *
 * @param leaders the pair's sub-route leaders
 * @param swayScale the factor its sway is priced at (its size factor)
 */
function calcScoreFloor(
        leaders: SubLeader[],
        swayScale: number): number {

    return Math.min(...leaders.map(l => l.c.shapeCost + swayScale*l.c.swayCost));
}


export { buildPair }
