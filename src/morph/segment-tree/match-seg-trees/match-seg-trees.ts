import type { Circle } from 'flo-mat';
import type { Segment, RouteStep } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { SegMatchedPair } from './seg-matched-pair.js';
import type { DualMap } from '../../../utils/dual-map.js';
import { DualMapFs } from '../../../utils/dual-map.js';
import { routeSegments } from '../route-segments.js';
import { sampleSegTree } from '../sample-seg-tree.js';
import { productDtw } from '../product-dtw.js';
import { outlineLenOf } from './outline-len-of.js';
import { lenOfSegs$ } from '../len-of.js';
import { endVariantsOf } from './end-variants-of.js';
import type { RouteEnds } from './route-pair-costs-of.js';
import { calcRoutePairsCosts, getRouteCosts } from './route-pair-costs-of.js';
import { getUnit$ } from '../get-unit.js';
import { anisoOf } from './aniso-of.js';
import { recordTrunkEval, recordTrunkCands } from '../../../debug/record-trunk-cands.js';
import { buildPair } from './build-pair.js';
import { cheapChildCost } from './cheap-child-cost.js';
import { childrenOf } from './children-of.js';
import { rankTrunkCandidates } from './rank-trunk-candidates.js';
import { pickBest } from './pick-best.js';
import { TARGET_SAMPLES, TRUNK_RECURSE_CANDS, TRUNK_CHEAP_CANDS } from './consts.js';


/** stands in for a variant's costs while collecting the route pairs to price */
const UNPRICED = { shapeCost: 0, swayCost: 0 };


/**
 * Hierarchical segment matching:
 *
 * * the trunk pair is the best freely-routed path pair (product-graph DTW)
 *   * DP states = (sample of A, sample of B) pairs
 *   * routes run leaf/fork to leaf/fork - terminal stretches beyond an end
 *     fork compete as ordinary children
 * * the subtrees hanging off the two routes are then aligned around the
 *   routes' outlines (cyclic Needleman-Wunsch)
 *   * relabel cost = position (along the outline) + angle + the score
 *     (`scoreOf`) of the child pair's best fully built sub-pair, from a
 *     pinned-start product DTW and its own recursion
 *   * terminal children in fork-sweep seam order, between the flanks
 * * matched child pairs recurse
 * * every decision (trunk, sub-route and child alignment) minimizes the
 *   same score: recursive cost + measured sway
 */
function matchSegTrees(
        gA: Segment[],
        gB: Segment[],
        loopA: number[][][],
        loopB: number[][][],
        weights: PathCostWeights): SegMatchedPair {

    const { sway, childSway } = weights;

    const unitA = getUnit$(loopA);
    const unitB = getUnit$(loopB);
    const aniso = anisoOf(loopA, loopB);

    const cheapChildCost_ = cheapChildCost(unitA, unitB, weights);

    // the trunk's local-sway measurement factor (rides the trunk DTW,
    // measured along the warp, not priced in it) - child pairs get their
    // own (`childSway`)
    const swayW = sway*aniso;

    const sA = sampleSegTree(gA, unitA, TARGET_SAMPLES, undefined);
    const sB = sampleSegTree(gB, unitB, TARGET_SAMPLES, undefined);

    const pd = productDtw(sA, sB, weights, swayW);

    const { pairOf } = buildPair(
        cheapChildCost_,
        gA, gB, unitA, unitB, weights, childSway
    );

    // Trunk candidates re-ranked by RECURSIVE cost too: orientation ties
    // (symmetric strokes) are invisible to the single-path DTW but decide
    // which side every child lands on - only recursion can break them right.
    // The DP objective is mirror-blind, so SWAY must enter BEFORE the beam
    // cut (rank by dp + sway): symmetric shapes tie exactly on dp cost and
    // the no-rotation pairing may otherwise not survive to the recursion.
    // Sway = LOCAL orientation diff MEASURED along each candidate's optimal
    // intrinsic warp (dtw swayCost) - a global route-mean angle diff cannot
    // see local 180° rotation when stroke means cancel (M→N), and pricing
    // sway INSIDE the DP objective lets the warp dodge it instead (gaps
    // around rotating material) - measurement must stay objective-neutral.
    // Sway stays out of the reported cost (children/shape stay intrinsic).
    const ranked = rankTrunkCandidates(pd.candidates);

    //-------------------------------------------------------------------
    // Stage 2: cheap child-consistency re-rank of the leaders (children
    // cached per unique route - the whole-tree scope is shared).
    //-------------------------------------------------------------------

    // routes cached per tree per unique (start, end)
    const routesA: DualMap<Circle, Circle, RouteStep[]> = new Map();
    const routesB: DualMap<Circle, Circle, RouteStep[]> = new Map();
    const routeOfA = routeOf(routesA, gA);
    const routeOfB = routeOf(routesB, gB);

    const childrenCacheA: DualMap<Circle, Circle, SegChild[]> = new Map();
    const childrenCacheB: DualMap<Circle, Circle, SegChild[]> = new Map();

    const childrenForA = childrenFor(childrenCacheA, gA, routeOfA, unitA);
    const childrenForB = childrenFor(childrenCacheB, gB, routeOfB, unitB);

    //----------------------------------------------------
    // rank = shape + sway + cheap: the routes' uncovered material is priced
    // through their children only (the DP's `totalCost` would charge it a
    // second time, as if dropped)
    const leaders = ranked.slice(0, TRUNK_CHEAP_CANDS);
    for (const leader of leaders) {
        const { c: { startA, startB, endA, endB, shapeCost, swayCost } } = leader;

        leader.cheap = cheapChildCost_(
            childrenForA(startA, endA),
            childrenForB(startB, endB),
            outlineLenOf(routeOfA(startA, endA)),
            outlineLenOf(routeOfB(startB, endB))
        );
        leader.rank = shapeCost + swayCost + leader.cheap;
    }
    leaders.sort((x, y) => x.rank - y.rank);
    //----------------------------------------------------

    // Route ends disagreeing in kind (fork vs leaf across a short tip) are
    // a near-tie to the DP - let the recursion try the alternatives.
    const δA = lenOfSegs$(gA) / TARGET_SAMPLES;
    const δB = lenOfSegs$(gB) / TARGET_SAMPLES;
    // The variants' route pairs are priced together - one DTW per start
    // pair (`calcRoutePairsCosts`): the leaders' variants come from only a
    // few start pairs.
    const heads = leaders.slice(0, TRUNK_RECURSE_CANDS);
    const wanted: RouteEnds[] = [];
    for (const l of heads) {
        endVariantsOf(l.c, gA, gB, (startA, endA, startB, endB) => {
            wanted.push([startA, endA, startB, endB]);
            return UNPRICED;
        });
    }
    const costs = calcRoutePairsCosts(
        wanted, routeOfA, routeOfB, unitA, unitB, δA, δB, weights, swayW);
    const evaluable = heads.flatMap(l =>
        endVariantsOf(l.c, gA, gB, (startA, endA, startB, endB) =>
            getRouteCosts(costs, startA, endA, startB, endB)
        ).map(c => ({ ...l, c })));

    const root = pickBest(evaluable, evaluable.length, l => {
        const { c: { startA, startB, endA, endB, shapeCost, swayCost } } = l;

        const routeA = routeOfA(startA, endA);
        const routeB = routeOfB(startB, endB);
        const pair = pairOf(
            gA, routeA,
            gB, routeB,
            shapeCost, swayCost
        );

        // debug only: notes the evaluation for the trunk-candidate table
        recordTrunkEval(l, pair);

        return pair;
    });

    // debug only: stores the trunk-candidate table
    recordTrunkCands([...evaluable, ...leaders.slice(TRUNK_RECURSE_CANDS)]);

    return root;
}


/**
 * Returns a function giving the route `s` → `e` in tree `g`, cached in
 * `routes` per unique (start, end).
 * @param routes
 * @param g
 */
function routeOf(
        routes: DualMap<Circle, Circle, RouteStep[]>,
        g: Segment[]) {

    return function(s: Circle, e: Circle): RouteStep[] {
        return DualMapFs.getOrInsertComputed(
            routes, s, e, () => routeSegments(g, s, e));
    }
}


/**
 * Returns a function giving the children hanging off the route `s` → `e`
 * in tree `g`, cached in `cache` per unique (start, end).
 * @param cache
 * @param g
 * @param routeOf_ the tree's (cached) route lookup
 * @param unit the tree's length normalization
 */
function childrenFor(
        cache: DualMap<Circle, Circle, SegChild[]>,
        g: Segment[],
        routeOf_: (s: Circle, e: Circle) => RouteStep[],
        unit: number) {

    return function(s: Circle, e: Circle): SegChild[] {
        return DualMapFs.getOrInsertComputed(
            cache, s, e, () => childrenOf(g, routeOf_(s, e), unit));
    }
}


export { matchSegTrees }

// 186
// angleCost, positionCost, subChildCost, subCost, subShapeCost, subSwayCost, total match cost