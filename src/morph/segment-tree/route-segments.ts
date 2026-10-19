import type { Circle } from 'flo-mat';
import type { Segment } from './segment.js';
import { geomOf$ } from './geom-of.js';
import { adjOf$ } from './adj-of.js';
import { farEnd } from './far-end.js';


/**
 * The unique route between two vertices of the tree, as segments
 * in travel order.
 */
function routeSegments(
        g: Segment[],
        v0: Circle,
        v1: Circle): { seg: Segment; reversed: boolean }[] {

    const adj = adjOf$(g);

    const prev = new Map<Circle, { seg: Segment; from: Circle }>();

    const seen = new Set([v0]);
    const queue = [v0];
    while (queue.length > 0) {
        const u = queue.shift()!;
        if (u === v1) { break; }
        for (const seg of adj.get(u) ?? []) {
            const to = farEnd(seg, u);
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
        out.push({ seg: p.seg, reversed: geomOf$(p.seg).vertE !== u });
        u = p.from;
    }
    return out.reverse();
}


export { routeSegments }
