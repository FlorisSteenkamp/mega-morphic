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
import type { FixedOps, FixedOf } from './fixed-ops.js';
import type { SeqOp } from '../../match-paths/align-seq.js';
import { alignSeq } from '../../match-paths/align-seq.js';
import { getCycle } from './align-outline.js';
import { calcSubWeights } from './calc-sub-weights.js';
import { routeEndsOf } from './outline-len-of.js';
import { subLeadersOf } from './sub-leaders-of.js';
import { lenOfSegs$, lenOfRoute$ } from '../len-of.js';
import { childrenOf } from './children-of.js';
import { subDtwOf } from './sub-dtw-of.js';
import {
    calcWarpPosCost, calcAngleCost, calcSizeFactor, calcDropCost,
    isPointMismatch
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
 * @param swayW child pairs' local-sway measurement factor (`childSway` -
 * measured along every sub-DTW warp; part of every decision, never added
 * to `cost`)
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

    return { pairOf, pairOfFixed: _buildPair, evalBest };


    /**
     * Returns the match-tree node of the route pair, its children matched
     * freely (`_buildPair` without fixed matches).
     */
    function pairOf(
            scopeA: Segment[],
            rA: RouteStep[],
            scopeB: Segment[],
            rB: RouteStep[],
            shapeCost: number,
            swayCost: number): SegMatchedPair {

        return _buildPair(scopeA, rA, scopeB, rB, shapeCost, swayCost, undefined);
    }


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
                const subWeights = calcSubWeights(weights, a, b);
                const ls = subLeadersOf(
                    subDtwOf(gA, gB, unitA, unitB, δA, δB, subWeights, swayW, a, b),
                    a, b, unitA, unitB, cheapChildCost_, sizeFactor);

                // variants priced junction → tip, as the sub-DTW runs, in
                // the parent's frame
                const rotB = a.routeDir - b.routeDir;
                const head = ls.slice(0, MAX_RECURSE_CANDS).flatMap(l =>
                    endVariantsOf(l.c, gA, gB, (startA, endA, startB, endB) =>
                        routePairCostsMemo.getOrInsertComputed(
                            calcRoutePairKey(startA, endA, startB, endB) +
                                `|${rotB}|${subWeights.gapOpen}`,
                            () => routePairCostsOf(
                                routeSegments(a.segs, startA, endA),
                                routeSegments(b.segs, startB, endB),
                                unitA, unitB, δA, δB, subWeights, swayW, rotB))
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
                    l.c.shapeCost, calcSizeFactor_(a, b)*l.c.swayCost,
                    undefined)));
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
     *   score (`scoreOf`: its recursive `cost` + its sway); per dropped
     *   child: its drop cost - exactly the prices the alignment decided
     *   with, so the children's sway counts in every choice above them too
     *   (a trunk whose children swing round loses to one whose children
     *   stay put)
     *
     * * `sway` = `swayCost`, the routes' own (not in `cost` - it enters
     *   the parent's `cost`, or the trunk's score, through `scoreOf`)
     *
     * * when `_debug_` is active, the final alignment DP is attached as `dp`
     *   (only without `fixedOf`)
     *
     * * with `fixedOf`, some child matches are already made (`FixedOps` -
     *   a coarser match, refined): those are taken as they are, and only
     *   the other children are aligned, in the gaps between them
     *   (`calcFreeGaps`)
     *
     * @param scopeA the segments of A the children are taken from
     * @param rA the route in A
     * @param scopeB the segments of B the children are taken from
     * @param rB the route in B
     * @param shapeCost the routes' own (DTW) shape cost
     * @param swayCost the routes' own measured warp sway
     * @param fixedOf the matches already made among the routes' children
     * (`undefined`: none)
     */
    function _buildPair(
            scopeA: Segment[],
            rA: RouteStep[],
            scopeB: Segment[],
            rB: RouteStep[],
            shapeCost: number,
            swayCost: number,
            fixedOf: FixedOf | undefined): SegMatchedPair {

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

            // a point matches only a point
            if (isPointMismatch(a, b, unitA, unitB)) { return Infinity; }

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

        /** runs the alignment until all the matches it picks are built */
        function alignLazily<T extends { ops: SeqOp<SegChild, SegChild>[] }>(
                align: () => T): T {

            let aligned = align();
            for (;;) {
                const unbuilt = aligned.ops.filter(
                    op => op.type === 'match' && !isBuilt(op.a, op.b));
                if (unbuilt.length === 0) { return aligned; }

                for (const op of unbuilt) {
                    if (op.type === 'match') { evalBest(op.a, op.b); }
                }
                aligned = align();
            }
        }

        const fixed = fixedOf === undefined ? undefined : fixedOf(chA, chB);

        const aligned = fixed === undefined
            ? alignLazily(() => alignOutline(chA, chB, matchCost, calcDropCost_))
            : undefined;

        // with fixed matches, the rest is aligned in the gaps between them
        const freeOps = aligned !== undefined
            ? aligned.ops
            : calcFreeGaps(chA, chB, fixed!).flatMap(({ as, bs, cyclic }) =>
                alignLazily(() => cyclic
                    ? alignOutline(as, bs, matchCost, calcDropCost_)
                    : alignSeq(as, bs, matchCost, calcDropCost_, calcDropCost_)
                ).ops);

        const ops: SegOp[] = [];
        let cost = shapeCost;

        for (const { a, b, sub } of fixed?.matches ?? []) {
            cost += calcPlaceCost(a, b) + scoreOf(sub);
            ops.push({ type: 'match', a, b, sub });
        }

        for (const op of freeOps) {
            if (op.type === 'match') {
                const subPair = evalBest(op.a, op.b);
                cost += calcPlaceCost(op.a, op.b) + scoreOf(subPair);
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

        const dp: SegDp | undefined =
            typeof _debug_ !== 'undefined' && aligned !== undefined
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
 * Returns the children still to be aligned, given the fixed matches, as
 * the stretches of the two outlines to align with each other:
 *
 * * between each two consecutive fixed matches (around the outlines), the
 *   children of A there with those of B there, in outline order (`cyclic`
 *   false) - so no new match crosses a fixed one
 *
 * * without fixed matches, or when they don't run in the same cyclic order
 *   in both outlines, all of them around the outlines (`cyclic` true)
 *
 * * the fixed matches' children are left out; stretches without children
 *   on either side are omitted
 *
 * @param chA the children of route A
 * @param chB the children of route B
 * @param fixed the matches already made
 */
function calcFreeGaps(
        chA: SegChild[],
        chB: SegChild[],
        fixed: FixedOps): { as: SegChild[]; bs: SegChild[]; cyclic: boolean }[] {

    const { matches } = fixed;

    const fixedA = new Set(matches.map(m => m.a));
    const fixedB = new Set(matches.map(m => m.b));

    const cycleA = getCycle(chA);
    const cycleB = getCycle(chB);

    const anchors = matches
        .map(({ a, b }) => [cycleA.indexOf(a), cycleB.indexOf(b)])
        .filter(([iA, iB]) => iA >= 0 && iB >= 0)
        .sort((x, y) => x[0] - y[0]);

    if (anchors.length === 0 || !isCyclicAscending(anchors.map(x => x[1]))) {
        return [{
            as: chA.filter(c => !fixedA.has(c)),
            bs: chB.filter(c => !fixedB.has(c)),
            cyclic: true
        }];
    }

    const gaps: { as: SegChild[]; bs: SegChild[]; cyclic: boolean }[] = [];
    const n = anchors.length;
    for (let k = 0; k < n; k++) {
        const [iA0, iB0] = anchors[k];
        const [iA1, iB1] = anchors[(k + 1) % n];

        const as = cyclicBetween(cycleA, iA0, iA1).filter(c => !fixedA.has(c));
        const bs = cyclicBetween(cycleB, iB0, iB1).filter(c => !fixedB.has(c));
        if (as.length > 0 || bs.length > 0) {
            gaps.push({ as, bs, cyclic: false });
        }
    }

    return gaps;
}


/**
 * Returns the items of the cycle strictly after index `i` up to strictly
 * before index `j`, going forward round it (`i === j`: all but `i`).
 */
function cyclicBetween<T>(
        cycle: T[],
        i: number,
        j: number): T[] {

    const n = cycle.length;
    const span = (j - i + n) % n || n;

    const out: T[] = [];
    for (let k = 1; k < span; k++) { out.push(cycle[(i + k) % n]); }

    return out;
}


/**
 * Returns `true` if the numbers ascend round a cycle: at most one descent,
 * counting the step from the last back to the first.
 */
function isCyclicAscending(xs: number[]): boolean {
    const n = xs.length;

    let descents = 0;
    for (let k = 0; k < n; k++) {
        if (xs[k] > xs[(k + 1) % n]) { descents++; }
    }

    return descents <= 1;
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
