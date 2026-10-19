import type { Circle } from 'flo-mat';
import type { Segment } from '../segment.js';
import { farEnd } from '../far-end.js';


/**
 * All segments reachable from `entry` (via `adj`) without passing through
 * `block`.
 *
 * @param entry the subtree's first segment (incident to `block`)
 * @param block the vertex the subtree hangs off
 * @param adj vertex → incident segments of the graph to search (e.g. the
 * scope minus the route)
 */
function collectSubtree(
        entry: Segment,
        block: Circle,
        adj: Map<Circle, Segment[]>): Segment[] {

    const segs = new Set([entry]);
    const queue = [farEnd(entry, block)];
    const seenV = new Set([block]);
    while (queue.length > 0) {
        const v = queue.pop()!;
        if (seenV.has(v)) { continue; }
        seenV.add(v);
        for (const s of adj.get(v) ?? []) {
            if (segs.has(s)) { continue; }
            segs.add(s);
            queue.push(farEnd(s, v));
        }
    }
    return [...segs];
}


export { collectSubtree }
