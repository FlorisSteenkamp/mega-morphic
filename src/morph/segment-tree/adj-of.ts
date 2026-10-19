import type { Circle } from 'flo-mat';
import type { Segment } from './segment.js';
import { memoize } from 'flo-memoize';
import { geomOf$ } from './geom-of.js';


/**
 * Returns the graph's adjacency: vertex → its incident segments, in segment
 * order (`vertS` then `vertE` of each).
 *
 * * memoized per `segs` array - don't mutate the result
 *
 * @param segs the graph's segments (e.g. a whole tree or a subtree)
 */
const adjOf$ = memoize(function(
        segs: Segment[]): Map<Circle, Segment[]> {

    const adj = new Map<Circle, Segment[]>();
    for (const s of segs) {
        const { vertS, vertE } = geomOf$(s);
        adj.getOrInsert(vertS, []).push(s);
        adj.getOrInsert(vertE, []).push(s);
    }

    return adj;
});


export { adjOf$ }
