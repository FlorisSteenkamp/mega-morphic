import type { Circle } from 'flo-mat';
import type { Segment, RouteStep } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { SegOp } from './seg-op.js';
import type { SegMatchedPair } from './seg-matched-pair.js';
import type { Ranked } from './ranked.js';
import { routeSegments } from '../route-segments.js';
import { sampleSegTree } from '../sample-seg-tree.js';
import { productDtw } from '../product-dtw.js';
import { lenOfRoute$, lenOfSegs$ } from '../len-of.js';
import { vertexIds$ } from '../vertex-ids.js';
import { getUnit$ } from '../get-unit.js';
import { anisoOf } from './aniso-of.js';
import { recordTrunkCands } from '../../../debug/record-trunk-cands.js';
import { buildPair } from './build-pair.js';
import { cheapChildCost } from './cheap-child-cost.js';
import { childrenOf } from './children-of.js';
import { TARGET_SAMPLES, CAND_MARGIN, TRUNK_RECURSE_CANDS, TRUNK_CHEAP_CANDS } from './consts.js';


/**
 * Hierarchical segment matching:
 *
 * * the trunk pair is the best freely-routed path pair (product-graph DTW)
 *   * DP states = (sample of A, sample of B) pairs
 *   * routes run leaf/fork to leaf/fork - terminal stretches beyond an end
 *     fork compete as ordinary children
 * * the subtrees hanging off the two routes are then Needleman-Wunsch-aligned per side
 *   * relabel cost = position + angle + a pinned-start product DTW
 *   * terminal children in fork-sweep seam order
 * * matched child pairs recurse
 * * the score is diagnostic-grade: a matched child's deeper subtrees are
 *   priced as covered-or-dropped inside its DTW rather than by its own
 *   recursion
 */
function matchSegTrees(
        gA: Segment[],
        gB: Segment[],
        loopA: number[][][],
        loopB: number[][][],
        weights: PathCostWeights): SegMatchedPair {

    const { sway } = weights;

    const unitA = getUnit$(loopA);
    const unitB = getUnit$(loopB);
    const aniso = anisoOf(loopA, loopB);

    const cheapChildCost_ = cheapChildCost(unitA, unitB, weights);

    // trunk-level sample spacing of trees
    const δA = lenOfSegs$(gA) / TARGET_SAMPLES;
    const δB = lenOfSegs$(gB) / TARGET_SAMPLES;

    // local-sway measurement factor (rides every DTW, measured along the
    // warp, not priced in it)
    const swayW = sway*aniso;

    const sA = sampleSegTree(gA, unitA, TARGET_SAMPLES, undefined);
    const sB = sampleSegTree(gB, unitB, TARGET_SAMPLES, undefined);

    const pd = productDtw(sA, sB, weights, swayW);

    const buildPair_ = buildPair(
        cheapChildCost_,
        gA, gB, unitA, unitB, δA, δB, weights, swayW
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

    // vertices are objects - dense per-tree ids make the string keys below
    const ids = { A: vertexIds$(gA), B: vertexIds$(gB) };
    const idA = (v: Circle): number => ids.A.get(v)!;
    const idB = (v: Circle): number => ids.B.get(v)!;

    const routes = new Map<string, RouteStep[]>();
    const routeOf_ = routeOf(routes, ids);

    const seen = new Set<string>();

    const ranked: Ranked[] = [];

    for (const c of pd.candidates) {
        // both-routes-reversed is the SAME end correspondence - dedupe
        // (costs differ only via the posCost start/end asymmetry; the slot
        // is worth more than that tie-break. Sway is invariant under double
        // reversal: both φ's shift by π.)
        const fwd = `${idA(c.startA)},${idA(c.endA)},${idB(c.startB)},${idB(c.endB)}`;
        const rev = `${idA(c.endA)},${idA(c.startA)},${idB(c.endB)},${idB(c.startB)}`;
        const key = fwd < rev ? fwd : rev;
        if (seen.has(key)) { continue; }
        seen.add(key);
        ranked.push({
            c,
            rank: c.totalCost + c.swayCost,
            cheap: 0
        });
    }
    ranked.sort((x, y) => x.rank - y.rank);

    //-------------------------------------------------------------------
    // Stage 2: cheap child-consistency re-rank of the leaders (children
    // cached per unique route - the whole-tree scope is shared).
    //-------------------------------------------------------------------
    const childCache = new Map<string, SegChild[]>();
    const childrenFor = (tag: 'A' | 'B', s: Circle, e: Circle): SegChild[] => {
        const k = `${tag}:${ids[tag].get(s)}:${ids[tag].get(e)}`;
        let ch = childCache.get(k);
        if (ch === undefined) {
            const g = tag === 'A' ? gA : gB;
            childCache.set(k, ch = childrenOf(g,
                routeOf_(g, tag, s, e), tag === 'A' ? unitA : unitB));
        }
        return ch;
    };
    const leaders = ranked.slice(0, TRUNK_CHEAP_CANDS);
    for (const l of leaders) {
        l.cheap = cheapChildCost_(
            childrenFor('A', l.c.startA, l.c.endA),
            childrenFor('B', l.c.startB, l.c.endB),
            lenOfRoute$(routeOf_(gA, 'A', l.c.startA, l.c.endA)),
            lenOfRoute$(routeOf_(gB, 'B', l.c.startB, l.c.endB)));
        l.rank += l.cheap;
    }
    leaders.sort((x, y) => x.rank - y.rank);

    let root: SegMatchedPair | undefined;
    let rootSel = Infinity;
    let chosen: Ranked | undefined;

    const evaluated = new Map<Ranked, { recCost: number; sel: number; ops: SegOp[] }>();

    const limit = leaders[0].rank + CAND_MARGIN;
    let evals = 0;
    for (const l of leaders) {
        const { c, rank } = l;
        if (rank > limit || evals >= TRUNK_RECURSE_CANDS) { break; }
        evals++;
        const pair = buildPair_(
            gA, routeOf_(gA, 'A', c.startA, c.endA),
            gB, routeOf_(gB, 'B', c.startB, c.endB),
            c.shapeCost);
        const sel = pair.cost + c.swayCost;
        evaluated.set(l, { recCost: pair.cost, sel, ops: pair.ops });
        if (sel < rootSel) {
            rootSel = sel;
            root = pair;
            chosen = l;
        }
    }
    recordTrunkCands(leaders, evaluated, chosen);

    return root!;
}


function routeOf(
       routes: Map<string, RouteStep[]>,
       ids: Record<'A' | 'B', Map<Circle, number>>) {

    return function(
            g: Segment[],
            tag: 'A' | 'B', s: Circle, e: Circle): RouteStep[] {

        const k = `${tag}:${ids[tag].get(s)}:${ids[tag].get(e)}`;
        let r = routes.get(k);
        if (r === undefined) {
            routes.set(k, r = routeSegments(g, s, e));
        }

        return r;
    }
}


export { matchSegTrees }
