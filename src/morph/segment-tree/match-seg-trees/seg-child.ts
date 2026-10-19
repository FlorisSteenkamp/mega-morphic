import type { Circle } from 'flo-mat';
import type { Segment } from '../segment.js';


/** A subtree hanging off a route. */
interface SegChild {
    /**
     * the tree vertex (fork - or route end) where the subtree attaches
     * to the route; sub-DTWs pin their route starts here
     */
    readonly attachV: Circle;
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
     * set for children at the route's end/start vertex: ordered by the
     * fork sweep (seam order) instead of dist/side
     */
    readonly terminal?: 'start' | 'end';
    /**
     * sweep-order key within the terminal group
     *
     * * set only together with `terminal`, i.e. only for children at the
     *   route's end/start vertex
     */
    readonly sweep?: number;
}


export type { SegChild }
