declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { SegGraph, Segment } from './segment-graph.js';
import type { FatBranchEdge } from '../fat-branch/fat-branch.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { SeqOp } from '../match-paths/align-seq.js';
import { routeSegments } from './segment-graph.js';
import { sampleSegGraph } from './sample-seg-graph.js';
import { productDtw } from './product-dtw.js';
import { alignSeq } from '../match-paths/align-seq.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';
import { sum } from '../../utils/sum.js';
import { mean } from '../../utils/mean.js';

const { abs, max, min, round, atan2, PI: π } = Math;

/** samples per glyph at the trunk level (sub-DTWs keep the same spacing) */
const TARGET_SAMPLES = 200;

/** sub-route candidates re-ranked by RECURSIVE cost (within margin of the
 *  DP-optimal) - a straight route + matched children can beat a zig-zag
 *  that merely covers more single-path material */
const MAX_RECURSE_CANDS = 4;
const CAND_MARGIN = 0.5;


/** A subtree hanging off a route (the segment-graph analog of PooledChild). */
interface SegChild {
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
    /**
     * the real tree edge when the subtree is a whole fat-branch subtree;
     * undefined for a CONTINUATION leftover (the route's own branch past a
     * fork) - matchable like any child (the builder suppresses stubs for
     * covered slices)
     */
    readonly edge?: FatBranchEdge;
    /** set for children at the route's end/start vertex: ordered by the
     *  fork sweep (seam order) instead of dist/side */
    readonly terminal?: 'start' | 'end';
    /** sweep-order key within the terminal group */
    readonly sweep?: number;
}

type RouteStep = { seg: Segment; reversed: boolean };

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

interface SegMatchResult {
    readonly root: SegMatchedPair;
    /** trunk route start vertices (orientation display) */
    readonly trunkStartA: number;
    readonly trunkStartB: number;
    /** = root.cost (no tails - diagnostic-grade) */
    readonly cost: number;
}


/**
 * Hierarchical segment matching (the segment-graph analog of `matchPaths`):
 * the trunk pair is the best freely-routed path pair (product DTW; routes
 * run leaf/fork to leaf/fork - terminal stretches beyond an end fork
 * compete as ordinary children), then the subtrees hanging off the two
 * routes are NW-aligned per side (position + angle + a pinned-start
 * product DTW as relabel cost; terminal children in fork-sweep seam order)
 * and matched pairs recurse. Score is diagnostic-grade: a matched child's
 * deeper subtrees are priced as covered-or-dropped inside its DTW rather
 * than by its own recursion.
 */
function matchSegGraphs(
        gA: SegGraph,
        gB: SegGraph,
        unitA: number,
        unitB: number,
        weights: PathCostWeights): SegMatchResult {

    const lenOf = (segs: Segment[]) => sum(segs.map(s => s.len));

    const δA = sum(gA.segments.map(s => s.len)) / TARGET_SAMPLES;
    const δB = sum(gB.segments.map(s => s.len)) / TARGET_SAMPLES;

    const sA = sampleSegGraph(gA, unitA, TARGET_SAMPLES);
    const sB = sampleSegGraph(gB, unitB, TARGET_SAMPLES);
    const pd = productDtw(sA, sB, weights);

    /** builds the pair node for a matched route pair, recursively */
    const buildPair = (
            scopeA: Segment[],
            rA: RouteStep[],
            scopeB: Segment[],
            rB: RouteStep[],
            shapeCost: number): SegMatchedPair => {

        const chA = childrenOf(gA, scopeA, rA, unitA);
        const chB = childrenOf(gB, scopeB, rB, unitB);

        // pinned-start sub-DTW per candidate pair, memoized (totalCost for
        // alignment decisions; graphs + candidates for recursive evaluation)
        const subs = new Map<SegChild, Map<SegChild, {
            dtw: ReturnType<typeof productDtw>;
            subA: SegGraph; subB: SegGraph }>>();
        const subOf = (a: SegChild, b: SegChild) => {
            let m = subs.get(a);
            if (m === undefined) { subs.set(a, m = new Map()); }
            let r = m.get(b);
            if (r === undefined) {
                const subA: SegGraph = {
                    vertices: gA.vertices, segments: a.segs,
                    attachOf: gA.attachOf
                };
                const subB: SegGraph = {
                    vertices: gB.vertices, segments: b.segs,
                    attachOf: gB.attachOf
                };
                const smA = sampleSegGraph(subA, unitA,
                    targetFor(lenOf(a.segs), δA), a.attachV);
                const smB = sampleSegGraph(subB, unitB,
                    targetFor(lenOf(b.segs), δB), b.attachV);
                m.set(b, r = {
                    dtw: productDtw(smA, smB, weights), subA, subB });
            }
            return r;
        };

        /** best sub-pair over the DTW's route candidates by RECURSIVE cost */
        const evalBest = (a: SegChild, b: SegChild): SegMatchedPair => {
            const { dtw, subA, subB } = subOf(a, b);
            const limit = dtw.candidates[0].totalCost + CAND_MARGIN;
            let best: SegMatchedPair | undefined;
            for (const c of dtw.candidates.slice(0, MAX_RECURSE_CANDS)) {
                if (c.totalCost > limit) { break; }
                const pair = buildPair(
                    a.segs,
                    reverseRoute(routeSegments(subA, a.attachV, c.endA)),
                    b.segs,
                    reverseRoute(routeSegments(subB, b.attachV, c.endB)),
                    c.shapeCost);
                if (best === undefined || pair.cost < best.cost) {
                    best = pair;
                }
            }
            return best!;
        };

        const matchCost = (a: SegChild, b: SegChild): number => {
            // terminal (seam) children only match terminal children -
            // regular ones only regular (side/seam sequences correspond)
            if ((a.terminal === undefined) !== (b.terminal === undefined)) {
                return Infinity;
            }
            return weights.position*abs(a.dist/unitA - b.dist/unitB) +
                weights.angle*abs(wrapAngle(a.angle - b.angle))/π +
                subOf(a, b).dtw.totalCost;
        };
        const delCost = (a: SegChild): number =>
            weights.delFloor + weights.del*a.material;
        const insCost = (b: SegChild): number =>
            weights.delFloor + weights.del*b.material;

        const ops: SegOp[] = [];
        const dp: SegDp[] | undefined =
            typeof _debug_ !== 'undefined' ? [] : undefined;
        let cost = shapeCost;

        // Per-side sequences in sleeve-boundary order: regular children by
        // dist, then that side's seam terminals in fork-sweep order (end
        // fork → out side's tail; start fork → back side's tail).
        const seqOf = (ch: SegChild[], side: 1 | -1): SegChild[] => [
            ...ch.filter(c => c.side === side && c.terminal === undefined)
                .sort((x, y) => side*(x.dist - y.dist)),
            ...ch.filter(c => c.terminal === (side === 1 ? 'end' : 'start'))
                .sort((x, y) => x.sweep! - y.sweep!)
        ];

        for (const side of [1, -1] as const) {
            const As = seqOf(chA, side);
            const Bs = seqOf(chB, side);

            const r = alignSeq(As, Bs, matchCost, delCost, insCost);
            dp?.push({ side, D: r.D, as: As, bs: Bs, ops: r.ops });

            for (const op of r.ops) {
                if (op.type === 'match') {
                    const subPair = evalBest(op.a, op.b);
                    cost += weights.position *
                            abs(op.a.dist/unitA - op.b.dist/unitB) +
                        weights.angle *
                            abs(wrapAngle(op.a.angle - op.b.angle))/π +
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

        return { routeA: rA, routeB: rB, shapeCost, cost, ops,
            ...(dp !== undefined ? { dp } : {}) };
    };

    // Trunk candidates re-ranked by RECURSIVE cost too: orientation ties
    // (symmetric strokes) are invisible to the single-path DTW but decide
    // which side every child lands on - only recursion can break them right.
    let root: SegMatchedPair | undefined;
    let startA = pd.startA;
    let startB = pd.startB;
    const limit = pd.candidates[0].totalCost + CAND_MARGIN;
    for (const c of pd.candidates) {
        if (c.totalCost > limit) { break; }
        const pair = buildPair(
            gA.segments,
            routeSegments(gA, c.startA, c.endA),
            gB.segments,
            routeSegments(gB, c.startB, c.endB),
            c.shapeCost);
        if (root === undefined || pair.cost < root.cost) {
            root = pair;
            startA = c.startA;
            startB = c.startB;
        }
    }

    return {
        root: root!,
        trunkStartA: startA,
        trunkStartB: startB,
        cost: root!.cost
    };
}


function reverseRoute(route: RouteStep[]): RouteStep[] {
    return route
        .map(s => ({ seg: s.seg, reversed: !s.reversed }))
        .reverse();
}


function targetFor(len: number, δ: number): number {
    return max(8, min(200, round(len / δ)));
}


/**
 * The subtrees hanging off a route within `scope`, with position along the
 * route, side and emanation angle (chord-based directions).
 */
function childrenOf(
        g: SegGraph,
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

            // edge-rooted iff the entry segment's branch attaches HERE -
            // otherwise the subtree is a continuation leftover
            const info = g.attachOf.get(entry.branch);
            const edge = info !== undefined && info.v === v
                ? info.edge
                : undefined;

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
                material: sum(segs.map(s => 2*mean(s.radii)*s.len)),
                ...(edge !== undefined ? { edge } : {}),
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


export { matchSegGraphs }
export type { SegMatchResult, SegMatchedPair, SegOp, SegChild, SegDp, RouteStep }
