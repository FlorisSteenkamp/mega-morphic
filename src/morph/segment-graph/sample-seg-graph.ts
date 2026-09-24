import type { SegGraph } from './segment-graph.js';
import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { totalLength$ } from '../fs/total-length.js';
import { clamp } from '../../utils/clamp.js';

const { max, round, min } = Math;


/**
 * The segment graph resampled into a DAG of directed feature samples for
 * product DTW: every segment yields two directed runs (v0→v1 and v1→v0) of
 * uniformly spaced (radius, turning) samples; runs chain at shared vertices
 * (no U-turns), so every walk through the DAG is a leaf-to-leaf skeleton
 * path sampled at (near) constant arc spacing.
 */
interface SampledSegGraph {
    /** normalized (÷ unit) radius per directed sample */
    readonly r: Float64Array;
    /** turning rate (dφ per normalized arc) per directed sample */
    readonly t: Float64Array;
    /** successor sample ids (within-run next, or continuations at a fork) */
    readonly succ: number[][];
    /** entry samples (runs leaving a leaf vertex) */
    readonly starts: number[];
    /** exit samples (runs arriving at a leaf vertex) */
    readonly ends: number[];
    /** leaf vertex id of each start/end sample (keyed by sample id) */
    readonly leafOf: Map<number, number>;
    /** sample id in topological order */
    readonly topo: number[];
    /** normalized arc spacing (cost integration step) */
    readonly step: number;
    /** total skeleton material ≈ Σ 2r̂ dŝ (≈ salience fraction of the tree) */
    readonly material: number;
}


/**
 * @param g the glyph's segment graph (or a segment subset sharing vertices)
 * @param unit length normalization (√ tree round salience, as the matcher)
 * @param target approximate total sample count over the whole skeleton
 * @param rootV pin routes to START at this vertex (junction-to-leaf paths
 * for subtree matching) instead of leaf-to-leaf
 */
function sampleSegGraph(
        g: SegGraph,
        unit: number,
        target: number,
        rootV?: number): SampledSegGraph {

    const totalLen = g.segments.reduce((s, x) => s + x.len, 0);
    const δ = totalLen / target;
    const step = δ / unit;

    const r: number[] = [];
    const t: number[] = [];
    const succ: number[][] = [];
    /** per segment per direction: its sample ids in travel order */
    const runs: { ids: number[]; tail: number; head: number }[] = [];

    for (const seg of g.segments) {
        const n = max(2, round(seg.len / δ) + 1);

        // per-knot cumulative positions + features (shared by both runs)
        const cum = [0];
        for (const ps of seg.pss) {
            cum.push(cum[cum.length - 1] + totalLength$(ps));
        }
        const knots = cum.map(c => seg.len > 0 ? c / seg.len : 0);
        knots[knots.length - 1] = 1;
        const φs = padTo(unwrappedChordAngles(seg.pss), seg.radii.length);

        const us: number[] = [];
        const rs: number[] = [];
        const φi: number[] = [];
        for (let i = 0; i < n; i++) {
            const u = i / (n - 1);
            us.push(u);
            rs.push(valueAt(seg.radii, knots, u) / unit);
            φi.push(valueAt(φs, knots, u));
        }
        // turning vs NORMALIZED arc (segment-local; fork turns not included)
        const Ln = seg.len / unit;
        const ts: number[] = [];
        for (let i = 0; i < n; i++) {
            const i0 = max(0, i - 1);
            const i1 = min(n - 1, i + 1);
            const ds = (us[i1] - us[i0]) * Ln;
            ts.push(ds > 0 ? (φi[i1] - φi[i0]) / ds : 0);
        }

        for (const rev of [false, true]) {
            const ids: number[] = [];
            for (let i = 0; i < n; i++) {
                const k = rev ? n - 1 - i : i;
                ids.push(r.length);
                r.push(rs[k]);
                t.push(ts[k]);  // sign irrelevant (costs use |t|)
                succ.push([]);
            }
            for (let i = 0; i + 1 < n; i++) {
                succ[ids[i]].push(ids[i + 1]);
            }
            runs.push({
                ids,
                tail: rev ? seg.v1 : seg.v0,
                head: rev ? seg.v0 : seg.v1
            });
        }
    }

    // chain runs at shared vertices (skip the successor's duplicate
    // vertex sample - enter at index 1); no U-turn back along the reverse run
    for (let i = 0; i < runs.length; i++) {
        const D = runs[i];
        const revOfD = i ^ 1;  // runs pushed in +,− pairs per segment
        for (let j = 0; j < runs.length; j++) {
            if (j === revOfD) { continue; }
            const E = runs[j];
            if (E.tail !== D.head) { continue; }
            succ[D.ids[D.ids.length - 1]].push(E.ids[1]);
        }
    }

    // leafness LOCAL to this segment set (sub-graphs share the vertex array)
    const degree = new Map<number, number>();
    for (const s of g.segments) {
        degree.set(s.v0, (degree.get(s.v0) ?? 0) + 1);
        degree.set(s.v1, (degree.get(s.v1) ?? 0) + 1);
    }
    const isLeaf = (v: number): boolean => degree.get(v) === 1;

    const starts: number[] = [];
    const ends: number[] = [];
    const leafOf = new Map<number, number>();
    for (const run of runs) {
        if (rootV !== undefined ? run.tail === rootV : isLeaf(run.tail)) {
            const id = run.ids[0];
            starts.push(id);
            leafOf.set(id, run.tail);
        }
        if (isLeaf(run.head) && run.head !== rootV) {
            const id = run.ids[run.ids.length - 1];
            ends.push(id);
            leafOf.set(id, run.head);
        }
    }

    return {
        r: Float64Array.from(r),
        t: Float64Array.from(t),
        succ,
        starts,
        ends,
        leafOf,
        topo: topoOrder(succ),
        step,
        // one direction of each segment (runs alternate +,−)
        material: runs.reduce((s, run, i) => i % 2 === 1 ? s
            : s + run.ids.reduce((m, id) => m + 2*r[id]*step, 0), 0)
    };
}


/** Kahn topological order over the sample DAG. */
function topoOrder(succ: number[][]): number[] {
    const n = succ.length;
    const indeg = new Array(n).fill(0);
    for (const ss of succ) {
        for (const s of ss) { indeg[s]++; }
    }
    const order: number[] = [];
    const queue: number[] = [];
    for (let i = 0; i < n; i++) {
        if (indeg[i] === 0) { queue.push(i); }
    }
    while (queue.length > 0) {
        const u = queue.pop()!;
        order.push(u);
        for (const v of succ[u]) {
            if (--indeg[v] === 0) { queue.push(v); }
        }
    }
    if (order.length !== n) { throw new Error('sample graph has a cycle'); }
    return order;
}


function padTo(vals: number[], m: number): number[] {
    const out = vals.slice();
    while (out.length < m) { out.push(out[out.length - 1] ?? 0); }
    return out;
}


/** Piecewise-linear value over `knots` at normalized position `u`. */
function valueAt(vals: number[], knots: number[], u: number): number {
    let j = 0;
    while (j < knots.length - 2 && knots[j + 1] <= u) { j++; }
    const span = knots[j + 1] - knots[j];
    const f = span <= 0 ? 0 : clamp((u - knots[j]) / span, 0, 1);
    return vals[j]*(1 - f) + vals[min(j + 1, vals.length - 1)]*f;
}


export { sampleSegGraph }
export type { SampledSegGraph }
