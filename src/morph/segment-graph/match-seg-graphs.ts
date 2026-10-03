declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { SegGraph } from './seg-graph.js';
import type { Segment, RouteStep } from './segment.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { SeqOp } from '../match-paths/align-seq.js';
import type { ProductDtwResult, ProductDtwResult_Candidate } from './product-dtw.js';
import { routeSegments } from './route-segments.js';
import { sampleSegGraph } from './sample-seg-graph.js';
import { productDtw } from './product-dtw.js';
import { alignSeq } from '../match-paths/align-seq.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';
import { sum } from '../../utils/sum.js';

const { abs, max, min, round, atan2, PI: π } = Math;

/** samples per glyph at the trunk level (sub-DTWs keep the same spacing) */
const TARGET_SAMPLES = 200;

/** sub-route candidates re-ranked by RECURSIVE cost (within margin of the
 *  DP-optimal) - a straight route + matched children can beat a zig-zag
 *  that merely covers more single-path material */
const MAX_RECURSE_CANDS = 4;
const CAND_MARGIN = 0.5;

/** trunk candidates given a full recursive evaluation (beam width) */
const TRUNK_RECURSE_CANDS = 8;

/** DP leaders given the cheap child-consistency re-rank, per level */
const TRUNK_CHEAP_CANDS = 64;
const SUB_CHEAP_CANDS = 16;


/** A subtree hanging off a route (the segment-graph analog of PooledChild). */
interface SegChild {
    /**
     * the graph vertex (fork - or route end) where the subtree attaches
     * to the route; sub-DTWs pin their route starts here
     */
    readonly attachV: number;
    /** arc distance from the route's start to the attach vertex */
    readonly dist: number;
    readonly side: 1 | -1;
    /** signed angle from the route's travel direction to the child's */
    readonly angle: number;
    /** the segment through which the subtree hangs off the route */
    readonly entry: Segment;
    /** the whole hanging subtree */
    readonly segs: Segment[];
    /** ≈ salience fraction of the subtree (Σ 2r̂ dŝ) */
    readonly material: number;
    /** set for children at the route's end/start vertex: ordered by the
     *  fork sweep (seam order) instead of dist/side */
    readonly terminal?: 'start' | 'end';
    /** sweep-order key within the terminal group */
    readonly sweep?: number;
}

type SegOp =
    | { type: 'match'; a: SegChild; b: SegChild; sub: SegMatchedPair }
    | { type: 'delete'; a: SegChild }
    | { type: 'insert'; b: SegChild };

/** Debug-only: one side's child-alignment DP (Needleman-Wunsch) data. */
interface SegDp {
    readonly side: 1 | -1;
    readonly D: number[][];
    readonly as: SegChild[];
    readonly bs: SegChild[];
    readonly ops: SeqOp<SegChild, SegChild>[];
}

/** A matched route pair with its recursive sub-matches. */
interface SegMatchedPair {
    /** travel order: trunk leaf→leaf; children tip→junction (as pathsOf) */
    readonly routeA: RouteStep[];
    readonly routeB: RouteStep[];
    readonly shapeCost: number;
    /** shape + child ops, recursive */
    readonly cost: number;
    readonly ops: SegOp[];
    /** set only when `_debug_` is active: per-side child-alignment DP */
    readonly dp?: SegDp[];
}

/** Debug-only: one leader of the trunk re-rank (recursion fields set only
 *  for candidates that got a full evaluation). */
interface TrunkCandDebug {
    readonly startA: number;
    readonly startB: number;
    readonly endA: number;
    readonly endB: number;
    readonly dpTotal: number;
    /** cheap child-consistency estimate used in the ranking */
    readonly cheap: number;
    /** local sway measured along the candidate's intrinsic warp */
    readonly sway: number;
    /** stage-2 rank = dp + sway + cheap */
    readonly rank: number;
    /** full recursive cost (buildPair) */
    readonly recCost?: number;
    /** selection value = recCost + sway */
    readonly sel?: number;
    readonly ops?: SegOp[];
}

interface SegMatchResult {
    readonly root: SegMatchedPair;
    /** trunk route start vertices (orientation display) */
    readonly trunkStartA: number;
    readonly trunkStartB: number;
    /** = root.cost (no tails - diagnostic-grade) */
    readonly cost: number;
    /** set only when `_debug_` is active: the evaluated re-rank table */
    readonly trunkCands?: TrunkCandDebug[];
}


interface Ranked {
    c: ProductDtwResult_Candidate;
    sway: number;
    rank: number;
    cheap: number;
}


/**
 * Hierarchical segment matching:
 * the trunk pair is the best freely-routed path pair (product-graph DTW:
 * DP states = pairs of samples, one per glyph; routes run leaf/fork to
 * leaf/fork - terminal stretches beyond an end fork compete as ordinary
 * children), then the subtrees hanging off the two routes are NW-aligned
 * per side (position + angle + a pinned-start product DTW as relabel cost;
 * terminal children in fork-sweep seam order) and matched pairs recurse.
 * Score is diagnostic-grade: a matched child's deeper subtrees are priced
 * as covered-or-dropped inside its DTW rather than by its own recursion.
 *
 * @param aniso mean shape anisotropy of the two glyphs (|c₂₀|/(Ixx+Iyy)):
 * scales the sway tie-break of the trunk orientation (0 = pose-blind)
 */
function matchSegGraphs(
        gA: SegGraph,
        gB: SegGraph,
        unitA: number,
        unitB: number,
        weights: PathCostWeights,
        aniso = 0): SegMatchResult {

    const { sway } = weights;

    const cheapChildCost_ = cheapChildCost(unitA, unitB, weights);

    const δA = getSampleSpacing(gA);
    const δB = getSampleSpacing(gB);

    // local-sway measurement factor (rides every DTW, objective-neutral)
    const swayW = sway*aniso;

    const sA = sampleSegGraph(gA, unitA, TARGET_SAMPLES);
    const sB = sampleSegGraph(gB, unitB, TARGET_SAMPLES);
    const pd = productDtw(sA, sB, weights, swayW);

    const buildPair_ = buildPair(cheapChildCost_, gA, gB, unitA, unitB, δA, δB, weights, swayW);

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
    const routes = new Map<string, RouteStep[]>();
    const routeOf_ = routeOf(routes);

    const seen = new Set<string>();

    const ranked: Ranked[] = [];

    for (const c of pd.candidates) {
        // both-routes-reversed is the SAME end correspondence - dedupe
        // (costs differ only via the posCost start/end asymmetry; the slot
        // is worth more than that tie-break. Sway is invariant under double
        // reversal: both φ's shift by π.)
        const fwd = `${c.startA},${c.endA},${c.startB},${c.endB}`;
        const rev = `${c.endA},${c.startA},${c.endB},${c.startB}`;
        const key = fwd < rev ? fwd : rev;
        if (seen.has(key)) { continue; }
        seen.add(key);
        ranked.push({
            c,
            sway: c.swayCost,
            rank: c.totalCost + c.swayCost,
            cheap: 0
        });
    }
    ranked.sort((x, y) => x.rank - y.rank);

    //-------------------------------------------------------------------
    // Stage 2: cheap child-consistency re-rank of the leaders (children
    // cached per unique route - the whole-graph scope is shared).
    //-------------------------------------------------------------------
    const childCache = new Map<string, SegChild[]>();
    const childrenFor = (tag: 'A' | 'B', s: number, e: number): SegChild[] => {
        const k = `${tag}:${s}:${e}`;
        let ch = childCache.get(k);
        if (ch === undefined) {
            const g = tag === 'A' ? gA : gB;
            childCache.set(k, ch = childrenOf(g.segments,
                routeOf_(g, tag, s, e), tag === 'A' ? unitA : unitB));
        }
        return ch;
    };
    const leaders = ranked.slice(0, TRUNK_CHEAP_CANDS);
    for (const l of leaders) {
        l.cheap = cheapChildCost_(
            childrenFor('A', l.c.startA, l.c.endA),
            childrenFor('B', l.c.startB, l.c.endB),
            routeLenOf(routeOf_(gA, 'A', l.c.startA, l.c.endA)),
            routeLenOf(routeOf_(gB, 'B', l.c.startB, l.c.endB)));
        l.rank += l.cheap;
    }
    leaders.sort((x, y) => x.rank - y.rank);

    let root: SegMatchedPair | undefined;
    let rootSel = Infinity;
    let startA = pd.startA;
    let startB = pd.startB;

    const evaluated = new Map<Ranked, { recCost: number; sel: number; ops: SegOp[] }>();

    const limit = leaders[0].rank + CAND_MARGIN;
    let evals = 0;
    for (const l of leaders) {
        const { c, sway, rank } = l;
        if (rank > limit || evals >= TRUNK_RECURSE_CANDS) { break; }
        evals++;
        const pair = buildPair_(
            gA.segments, routeOf_(gA, 'A', c.startA, c.endA),
            gB.segments, routeOf_(gB, 'B', c.startB, c.endB),
            c.shapeCost);
        const sel = pair.cost + sway;
        evaluated.set(l, { recCost: pair.cost, sel, ops: pair.ops });
        if (sel < rootSel) {
            rootSel = sel;
            root = pair;
            startA = c.startA;
            startB = c.startB;
        }
    }
    const trunkCands: TrunkCandDebug[] | undefined =
        addDebugInfo(leaders, evaluated);

    return {
        root: root!,
        trunkStartA: startA,
        trunkStartB: startB,
        cost: root!.cost,
        ...(trunkCands !== undefined ? { trunkCands } : {})
    };
}


function addDebugInfo(
        leaders: {
            c: ProductDtwResult_Candidate;
            sway: number;
            rank: number;
            cheap: number;
        }[],
        evaluated: Map<Ranked, { recCost: number; sel: number; ops: SegOp[] }>) {

    return typeof _debug_ !== 'undefined'
            ? leaders.map(l => ({
                startA: l.c.startA, startB: l.c.startB,
                endA: l.c.endA, endB: l.c.endB,
                dpTotal: l.c.totalCost, cheap: l.cheap,
                sway: l.sway, rank: l.rank,
                ...(evaluated.get(l) ?? {})
            }))
            : undefined;
}


/**
 * Sub-DTW-free child-alignment estimate: relabel = position + angle +
 * del·|Δmaterial|; drops at full price.
 * 
 * The route DP is blind to child
 * correspondence, which can dominate the recursive cost (a wrong end
 * choice orphans whole subtrees) - this ranks end choices by it
 * BEFORE spending recursion slots.
 */
function cheapChildCost(
        unitA: number,
        unitB: number,
        weights: PathCostWeights) {

    return function(
            chA: SegChild[], chB: SegChild[],
            lenRA: number, lenRB: number): number {

        const cheapMatch = (a: SegChild, b: SegChild): number =>
            terminalGated(a, b) ? Infinity
            : posCostOf(a, b, lenRA, lenRB, unitA, unitB, weights) +
                angleCostOf(a, b, weights) +
                weights.del*abs(a.material - b.material);
        const drop = (c: SegChild): number => dropCostOf(c, weights);
        let cost = 0;
        for (const side of [1, -1] as const) {
            cost += alignSeq(seqOf(chA, side), seqOf(chB, side),
                cheapMatch, drop, drop).cost;
        }

        return cost;
    }
}


function routeOf(
       routes: Map<string, RouteStep[]>) {

    return function(
            g: SegGraph, tag: string, s: number, e: number): RouteStep[] {

        const k = `${tag}:${s}:${e}`;
        let r = routes.get(k);
        if (r === undefined) {
            routes.set(k, r = routeSegments(g, s, e));
        }

        return r;
    }
}


/** builds the pair node for a matched route pair, recursively */
function buildPair(
        cheapChildCost: (chA: SegChild[], chB: SegChild[], lenRA: number, lenRB: number) => number,
        gA: SegGraph,
        gB: SegGraph,
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        swayW: number) {

    return _buildPair;

    function _buildPair(
            scopeA: Segment[],
            rA: RouteStep[],
            scopeB: Segment[],
            rB: RouteStep[],
            shapeCost: number): SegMatchedPair {

        const chA = childrenOf(scopeA, rA, unitA);
        const chB = childrenOf(scopeB, rB, unitB);
        const lenRA = routeLenOf(rA);
        const lenRB = routeLenOf(rB);

        // pinned-start sub-DTW per candidate pair, memoized (totalCost for
        // alignment decisions; graphs + candidates for recursive evaluation)
        const subs = new Map<SegChild, Map<SegChild, SubDtw>>();
        const subOf = (a: SegChild, b: SegChild) => {
            let m = subs.get(a);
            if (m === undefined) { subs.set(a, m = new Map()); }
            let r = m.get(b);
            if (r === undefined) {
                m.set(b, r = subDtwOf(gA, gB, unitA, unitB, δA, δB, weights, swayW, a, b));
            }
            return r;
        };

        /** best sub-pair over the DTW's route candidates by RECURSIVE cost
         *  (DP leaders first re-ranked by the cheap child estimate;
         *  measured warp sway rides every rank/selection) */
        function evalBest(a: SegChild, b: SegChild): SegMatchedPair {
            const { dtw, subA, subB } = subOf(a, b);
            const leaders = dtw.candidates.slice(0, SUB_CHEAP_CANDS)
                .map(c => {
                    const rA = reverseRoute(
                        routeSegments(subA, a.attachV, c.endA));
                    const rB = reverseRoute(
                        routeSegments(subB, b.attachV, c.endB));
                    return { c, rA, rB,
                        rank: c.totalCost + c.swayCost + cheapChildCost(
                            childrenOf(a.segs, rA, unitA),
                            childrenOf(b.segs, rB, unitB),
                            routeLenOf(rA), routeLenOf(rB)) };
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
            posCostOf(a, b, lenRA, lenRB, unitA, unitB, weights);

        const matchCost = (a: SegChild, b: SegChild): number => {
            if (terminalGated(a, b)) { return Infinity; }
            const { dtw } = subOf(a, b);
            // + measured warp sway: a child pairing that would visibly
            // rotate loses to a drop / a same-orientation partner
            return posCost(a, b) + angleCostOf(a, b, weights) +
                dtw.totalCost + dtw.swayCost;
        };
        const delCost = (a: SegChild): number => dropCostOf(a, weights);
        const insCost = (b: SegChild): number => dropCostOf(b, weights);

        const ops: SegOp[] = [];
        const dp: SegDp[] | undefined =
            typeof _debug_ !== 'undefined' ? [] : undefined;
        let cost = shapeCost;

        for (const side of [1, -1] as const) {
            const As = seqOf(chA, side);
            const Bs = seqOf(chB, side);

            const r = alignSeq(As, Bs, matchCost, delCost, insCost);
            dp?.push({ side, D: r.D, as: As, bs: Bs, ops: r.ops });

            for (const op of r.ops) {
                if (op.type === 'match') {
                    const subPair = evalBest(op.a, op.b);
                    cost += posCost(op.a, op.b) +
                        angleCostOf(op.a, op.b, weights) +
                        subPair.cost;
                    ops.push({
                        type: 'match', a: op.a, b: op.b, sub: subPair });
                } else if (op.type === 'delete') {
                    cost += delCost(op.a);
                    ops.push(op);
                } else {
                    cost += insCost(op.b);
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


function reverseRoute(route: RouteStep[]): RouteStep[] {
    return route
        .map(s => ({ seg: s.seg, reversed: !s.reversed }))
        .reverse();
}


function targetFor(len: number, δ: number): number {
    return max(8, min(200, round(len / δ)));
}


function getSegsLen(segs: Segment[]): number {
    return sum(segs.map(s => s.len));
}


function routeLenOf(r: RouteStep[]): number {
    return sum(r.map(s => s.seg.len));
}


/** trunk-level sample spacing of a graph */
function getSampleSpacing(g: SegGraph): number {
    return getSegsLen(g.segments) / TARGET_SAMPLES;
}

// Quadratic in the normalized mismatch: small slides along the trunk stay
// cheap, long-distance moves get prohibitive. Positions are compared as
// ROUTE FRACTIONS (scale-invariant AND mass-independent - per-glyph units
// skew same-position children when total salience differs, e.g. M vs N,
// worst exactly at route ends), rescaled by the mean normalized route
// length so this reduces to the old (dA/uA - dB/uB)² when the two agree.
function posCostOf(
        a: SegChild, b: SegChild,
        routeLenA: number, routeLenB: number,
        unitA: number, unitB: number,
        w: PathCostWeights): number {

    const λ = (routeLenA/unitA + routeLenB/unitB) / 2;

    return w.position*(λ*(a.dist/routeLenA - b.dist/routeLenB))**2;
};


function angleCostOf(
        a: SegChild,
        b: SegChild,
        w: PathCostWeights): number {

    return w.angle*abs(wrapAngle(a.angle - b.angle))/π;
}

function dropCostOf(
        c: SegChild,
        w: PathCostWeights): number {

    return w.delFloor + w.del*c.material;
}


// terminal (seam) children only match terminal children - regular ones
// only regular (side/seam sequences correspond)
const terminalGated = (a: SegChild, b: SegChild): boolean =>
    (a.terminal === undefined) !== (b.terminal === undefined);

// Per-side sequences in sleeve-boundary order: regular children by dist,
// then that side's seam terminals in fork-sweep order (end fork → out
// side's tail; start fork → back side's tail).
const seqOf = (ch: SegChild[], side: 1 | -1): SegChild[] => [
    ...ch.filter(c => c.side === side && c.terminal === undefined)
        .sort((x, y) => side*(x.dist - y.dist)),
    ...ch.filter(c => c.terminal === (side === 1 ? 'end' : 'start'))
        .sort((x, y) => x.sweep! - y.sweep!)
];


/** Route steps → composed skeleton geometry (as composePieces). */
function composeRoute(route: RouteStep[]): {
        skelPss: number[][][]; radii: number[]; L: number } {

    const skelPss: number[][][] = [];
    const radii: number[] = [];
    let L = 0;
    for (const { seg, reversed } of route) {
        const pss = reversed
            ? seg.pss.map(ps => ps.toReversed()).reverse()
            : seg.pss;
        const rd = reversed ? seg.radii.toReversed() : seg.radii;
        skelPss.push(...pss);
        radii.push(...(radii.length > 0 ? rd.slice(1) : rd));
        L += seg.len;
    }
    return { skelPss, radii, L };
}


interface SubDtw {
    readonly dtw: ProductDtwResult;
    readonly subA: SegGraph;
    readonly subB: SegGraph;
}


/** Pinned-start sub-DTW of a child pair - the relabel core of `matchCost`. */
function subDtwOf(
        gA: SegGraph,
        gB: SegGraph,
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        sway: number,
        a: SegChild,
        b: SegChild): SubDtw {

    const subA: SegGraph = {
        loop: gA.loop,
        unit: gA.unit,
        vertices: gA.vertices,
        segments: a.segs
    };
    const subB: SegGraph = {
        loop: gB.loop,
        unit: gB.unit,
        vertices: gB.vertices,
        segments: b.segs
    };

    const smA = sampleSegGraph(subA, unitA,
        targetFor(getSegsLen(a.segs), δA), a.attachV);
    const smB = sampleSegGraph(subB, unitB,
        targetFor(getSegsLen(b.segs), δB), b.attachV);
    return { dtw: productDtw(smA, smB, weights, sway), subA, subB };
}


/** One child pair priced by the matcher's actual economics. */
interface ChildPairPrice {
    /** terminal↔regular gate fired: `matchCost` = Infinity */
    readonly gated: boolean;
    readonly positionCost: number;
    readonly angleCost: number;
    /** pinned-start sub-DTW total incl. measured warp sway */
    readonly dtwCost: number;
    /** position + angle + dtw (the DP's relabel price; Infinity when gated) */
    readonly matchCost: number;
    readonly deleteCost: number;
    readonly insertCost: number;
    readonly dtw: ProductDtwResult;
    readonly subA: SegGraph;
    readonly subB: SegGraph;
}


/**
 * Debug: prices one child pair exactly as the matcher's `matchCost` /
 * `delCost` / `insCost` would (fresh, unmemoized) - the authoritative
 * relabel-vs-drop economics for the pair. Route lengths are the PARENT
 * routes the children are pooled on (position is a route fraction).
 */
function priceChildPair(
        gA: SegGraph, gB: SegGraph,
        unitA: number, unitB: number,
        routeLenA: number, routeLenB: number,
        weights: PathCostWeights,
        sway: number,
        a: SegChild, b: SegChild): ChildPairPrice {

    const { dtw, subA, subB } = subDtwOf(gA, gB, unitA, unitB,
        getSampleSpacing(gA), getSampleSpacing(gB), weights, sway, a, b);
    const gated = terminalGated(a, b);
    const positionCost = posCostOf(
        a, b, routeLenA, routeLenB, unitA, unitB, weights);
    const angleCost = angleCostOf(a, b, weights);
    return {
        gated, positionCost, angleCost,
        dtwCost: dtw.totalCost + dtw.swayCost,
        matchCost: gated
            ? Infinity
            : positionCost + angleCost + dtw.totalCost + dtw.swayCost,
        deleteCost: dropCostOf(a, weights),
        insertCost: dropCostOf(b, weights),
        dtw, subA, subB
    };
}


/**
 * The subtrees hanging off a route within `scope`, with position along the
 * route, side and emanation angle (chord-based directions).
 */
function childrenOf(
        scope: Segment[],
        route: RouteStep[],
        unit: number): SegChild[] {

    const routeSegs = new Set(route.map(r => r.seg));
    const scopeSet = new Set(scope);

    const adj = new Map<number, Segment[]>();
    for (const s of scope) {
        if (routeSegs.has(s)) { continue; }
        for (const v of [s.v0, s.v1]) {
            let list = adj.get(v);
            if (list === undefined) { adj.set(v, list = []); }
            list.push(s);
        }
    }

    // route vertex sequence + cumulative dist + local travel direction
    const verts: number[] = [];
    const dists: number[] = [];
    const dirs: number[][] = [];
    let d = 0;
    for (let i = 0; i < route.length; i++) {
        const { seg, reversed } = route[i];
        const v = reversed ? seg.v1 : seg.v0;
        const dirOutV = chordDir(seg, reversed ? 'endRev' : 'start');
        if (i === 0) {
            verts.push(v); dists.push(d); dirs.push(dirOutV);
        } else {
            // interior vertex: mean of arriving and leaving directions
            const prev = route[i - 1];
            const dirIn = chordDir(prev.seg, prev.reversed ? 'startRev' : 'end');
            dirs[dirs.length - 1] = meanDir(dirIn, dirOutV);
        }
        d += seg.len;
        verts.push(reversed ? seg.v0 : seg.v1);
        dists.push(d);
        dirs.push(chordDir(seg, reversed ? 'startRev' : 'end'));
    }

    const out: SegChild[] = [];
    const claimed = new Set<Segment>();

    const startV = verts[0];
    const endV = verts[verts.length - 1];

    for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        for (const entry of adj.get(v) ?? []) {
            if (claimed.has(entry)) { continue; }
            const segs = collectSubtree(entry, v, scopeSet, routeSegs);
            for (const s of segs) { claimed.add(s); }

            const cd = chordDir(entry, entry.v0 === v ? 'start' : 'endRev');
            const rd = dirs[i];
            const cross = rd[0]*cd[1] - rd[1]*cd[0];
            const dot = rd[0]*cd[0] + rd[1]*cd[1];
            const θ = atan2(cross, dot);

            // Seam terminals: children AT a route end, ordered by the fork
            // sweep (the sleeve boundary walks the end cap from the out
            // side: descending θ; the start cap toward the out side:
            // ascending θ). The cut sits at the route's own prong, so the
            // order is well defined even for collinear continuations.
            const terminal = i === verts.length - 1 && v === endV
                ? 'end' as const
                : i === 0 && v === startV
                ? 'start' as const
                : undefined;
            const sweep = terminal === 'end' ? -θ
                : terminal === 'start' ? θ
                : undefined;

            out.push({
                attachV: v,
                dist: dists[i],
                side: cross >= 0 ? 1 : -1,
                angle: θ,
                entry,
                segs,
                material: sum(segs.map(s => s.material)) / (unit*unit),
                ...(terminal !== undefined ? { terminal, sweep } : {})
            });
        }
    }

    return out;
}


/** All scope segments reachable from `entry` without passing through `block`. */
function collectSubtree(
        entry: Segment,
        block: number,
        scope: Set<Segment>,
        routeSegs: Set<Segment>): Segment[] {

    const adj = new Map<number, Segment[]>();
    for (const s of scope) {
        if (routeSegs.has(s)) { continue; }
        for (const v of [s.v0, s.v1]) {
            let list = adj.get(v);
            if (list === undefined) { adj.set(v, list = []); }
            list.push(s);
        }
    }

    const segs = new Set([entry]);
    const queue = [entry.v0 === block ? entry.v1 : entry.v0];
    const seenV = new Set([block]);
    while (queue.length > 0) {
        const v = queue.pop()!;
        if (seenV.has(v)) { continue; }
        seenV.add(v);
        for (const s of adj.get(v) ?? []) {
            if (segs.has(s)) { continue; }
            segs.add(s);
            queue.push(s.v0 === v ? s.v1 : s.v0);
        }
    }
    return [...segs];
}


/** Chord direction of a segment's first/last bezier, optionally reversed. */
function chordDir(
        seg: Segment,
        which: 'start' | 'end' | 'startRev' | 'endRev'): number[] {

    const atStart = which === 'start' || which === 'startRev';
    const ps = atStart ? seg.pss[0] : seg.pss[seg.pss.length - 1];
    const p0 = ps[0];
    const p1 = ps[ps.length - 1];
    const rev = which === 'startRev' || which === 'endRev';
    return rev
        ? [p0[0] - p1[0], p0[1] - p1[1]]
        : [p1[0] - p0[0], p1[1] - p0[1]];
}


function meanDir(d1: number[], d2: number[]): number[] {
    const l1 = Math.hypot(d1[0], d1[1]);
    const l2 = Math.hypot(d2[0], d2[1]);
    if (l1 === 0) { return d2; }
    if (l2 === 0) { return d1; }
    const mx = d1[0]/l1 + d2[0]/l2;
    const my = d1[1]/l1 + d2[1]/l2;
    return Math.hypot(mx, my) < 1e-9 ? d1 : [mx, my];
}


export { matchSegGraphs, priceChildPair, reverseRoute, composeRoute }
export type { SegMatchResult, SegMatchedPair, SegOp, SegChild, SegDp,
    RouteStep, ChildPairPrice, TrunkCandDebug }
