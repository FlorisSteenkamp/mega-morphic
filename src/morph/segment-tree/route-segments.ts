import type { Circle } from 'flo-mat';
import type { Segment } from './segment.js';


/**
 * The unique route between two vertices of the tree, as segments
 * in travel order.
 */
function routeSegments(
        g: Segment[],
        v0: Circle,
        v1: Circle): { seg: Segment; reversed: boolean }[] {

    /** vertex → its incident segments (with the far vertex) */
    const adj = new Map<Circle, { seg: Segment; to: Circle }[]>();

    function link(v: Circle, seg: Segment, to: Circle): void {
        adj.getOrInsert(v, []).push({ seg, to });
    };

    for (const seg of g) {
        link(seg.vertS, seg, seg.vertE);
        link(seg.vertE, seg, seg.vertS);
    }

    const prev = new Map<Circle, { seg: Segment; from: Circle }>();

    const seen = new Set([v0]);
    const queue = [v0];
    while (queue.length > 0) {
        const u = queue.shift()!;
        if (u === v1) { break; }
        for (const { seg, to } of adj.get(u) ?? []) {
            if (!seen.has(to)) {
                seen.add(to);
                prev.set(to, { seg, from: u });
                queue.push(to);
            }
        }
    }

    const out: { seg: Segment; reversed: boolean }[] = [];
    let u = v1;
    while (u !== v0) {
        const p = prev.get(u);
        if (p === undefined) { return []; }  // disconnected (shouldn't happen)
        out.push({ seg: p.seg, reversed: p.seg.vertE !== u });
        u = p.from;
    }
    return out.reverse();
}


export { routeSegments }
