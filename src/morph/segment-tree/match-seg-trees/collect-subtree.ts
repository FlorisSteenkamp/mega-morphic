import type { Circle } from 'flo-mat';
import type { Segment } from '../segment.js';
import { geomOf$ } from '../geom-of.js';


/** All scope segments reachable from `entry` without passing through `block`. */
function collectSubtree(
        entry: Segment,
        block: Circle,
        scope: Set<Segment>,
        routeSegs: Set<Segment>): Segment[] {

    const adj = new Map<Circle, Segment[]>();
    for (const s of scope) {
        if (routeSegs.has(s)) { continue; }
        const { vertS, vertE } = geomOf$(s);
        for (const v of [vertS, vertE]) {
            adj.getOrInsert(v, []).push(s);
        }
    }

    /** the segment's end vertex other than `v` */
    const farEnd = (s: Segment, v: Circle): Circle => {
        const { vertS, vertE } = geomOf$(s);
        return vertS === v ? vertE : vertS;
    };

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
