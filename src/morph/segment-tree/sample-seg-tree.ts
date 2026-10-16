import type { Circle } from 'flo-mat';
import type { Segment } from './segment.js';
import type { SampledSegGraph } from './sampled-seg-graph.js';
import { sampleProfile } from '../fs/sample-profile.js';
import { lenOfSegs$ } from './len-of.js';
import { geomOf$ } from './geom-of.js';

const { max, round, PI: π } = Math;


/**
 * @param g the glyph's segment tree (or a segment subset sharing vertices)
 * @param unit length normalization (√ tree round salience, as the matcher)
 * @param sampleCount approximate total sample count over the whole skeleton
 * (each segment rounds up to at least two samples, so the actual count can
 * come out slightly higher)
 * @param rootV pin routes to START at this vertex (junction-to-leaf paths
 * for subtree matching) instead of leaf-to-leaf
 */
function sampleSegTree(
        g: Segment[],
        unit: number,
        sampleCount: number,
        rootV: Circle | undefined): SampledSegGraph {

    const totalLen = lenOfSegs$(g);

    const δ = totalLen/sampleCount;
    const step = δ/unit;

    const r: number[] = [];
    const t: number[] = [];
    const φ: number[] = [];
    const succ: number[][] = [];

    /** per segment per direction: its sample ids in travel order */
    const runs: {
        ids: number[];
        tail: Circle;
        head: Circle
    }[] = [];

    for (const seg of g) {
        const { skelPss, radii, vertS, vertE, skelLen } = geomOf$(seg);

        const n = max(2, round(skelLen / δ) + 1);

        // features shared by both runs; turning vs NORMALIZED arc
        // (segment-local; fork turns not included)
        const { r: rs, φ: φi, turn: ts } = sampleProfile(
            skelPss, radii, unit, n, skelLen / unit);

        for (const rev of [false, true]) {
            const ids: number[] = [];
            for (let i = 0; i < n; i++) {
                const k = rev ? n - 1 - i : i;
                ids.push(r.length);
                r.push(rs[k]);
                t.push(ts[k]);  // sign irrelevant (costs use |t|)
                φ.push(φi[k] + (rev ? π : 0));
                succ.push([]);
            }
            for (let i = 0; i + 1 < n; i++) {
                succ[ids[i]].push(ids[i + 1]);
            }
            runs.push({
                ids,
                tail: rev ? vertE : vertS,
                head: rev ? vertS : vertE
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

    // leafness LOCAL to this segment set (sub-trees share vertices)
    const degree = new Map<Circle, number>();
    for (const s of g) {
        const { vertS, vertE } = geomOf$(s);
        degree.set(vertS, (degree.get(vertS) ?? 0) + 1);
        degree.set(vertE, (degree.get(vertE) ?? 0) + 1);
    }
    const isLeaf = (v: Circle): boolean => degree.get(v) === 1;
    const isFork = (v: Circle): boolean => (degree.get(v) ?? 0) >= 3;

    // Routes may start/end at leaves OR STOP at a fork (the terminal
    // stretch beyond it then competes as an ordinary child).
    const isEnd = (v: Circle): boolean => isLeaf(v) || isFork(v);

    const starts: number[] = [];
    const ends: number[] = [];
    const leafOf = new Map<number, Circle>();
    for (const run of runs) {
        if (rootV !== undefined ? run.tail === rootV : isEnd(run.tail)) {
            const id = run.ids[0];
            starts.push(id);
            leafOf.set(id, run.tail);
        }
        if (isEnd(run.head) && run.head !== rootV) {
            const id = run.ids[run.ids.length - 1];
            ends.push(id);
            leafOf.set(id, run.head);
        }
    }

    return {
        r: Float64Array.from(r),
        t: Float64Array.from(t),
        φ: Float64Array.from(φ),
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


export { sampleSegTree }
