import type { Segment } from './segment.js';
import type { SegGraph } from './seg-graph.js';


/**
 * The unique route between two vertices (the graph is a tree), as segments
 * in travel order.
 */
function routeSegments(
        g: SegGraph,
        v0: number,
        v1: number): { seg: Segment; reversed: boolean }[] {

    const adj: { seg: Segment; to: number }[][] =
        g.vertices.map(() => []);
    for (const seg of g.segments) {
        adj[seg.vertIdS].push({ seg, to: seg.vertIdE });
        adj[seg.vertIdE].push({ seg, to: seg.vertIdS });
    }

    const prev = new Array<{ seg: Segment; from: number } | undefined>(
        g.vertices.length);
    const seen = new Set([v0]);
    const queue = [v0];
    while (queue.length > 0) {
        const u = queue.shift()!;
        if (u === v1) { break; }
        for (const { seg, to } of adj[u]) {
            if (!seen.has(to)) {
                seen.add(to);
                prev[to] = { seg, from: u };
                queue.push(to);
            }
        }
    }

    const out: { seg: Segment; reversed: boolean }[] = [];
    let u = v1;
    while (u !== v0) {
        const p = prev[u];
        if (p === undefined) { return []; }  // disconnected (shouldn't happen)
        out.push({ seg: p.seg, reversed: p.seg.vertIdE !== u });
        u = p.from;
    }
    return out.reverse();
}


export { routeSegments }
