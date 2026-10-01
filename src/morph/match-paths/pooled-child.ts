import type { Segment } from '../segment-graph/segment.js';


/**
 * A subtree hanging off a matched route, with side/angle relative to the
 * ROUTE's travel direction.
 */
interface PooledChild {
    /** the segment through which the subtree hangs off the route */
    readonly entry: Segment;
    /** the whole hanging subtree */
    readonly segs: Segment[];
    /** skeleton arc distance from the route's start to the attach vertex */
    readonly dist: number;
    readonly side: 1 | -1;
    readonly angle: number;
    /** ≈ salience fraction of the subtree (÷ unit²) */
    readonly material: number;
}


export type { PooledChild }