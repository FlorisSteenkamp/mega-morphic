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
    /**
     * the route's absolute travel direction at the attach vertex
     *
     * * the parent frame the child is measured in: the morph carries a
     *   glued child along with its parent's rotation, so the child's own
     *   sway is measured relative to it (`subDtwOf`)
     */
    readonly routeDir: number;
    /** the segment through which the subtree hangs off the route */
    readonly entry: Segment;
    /** the whole hanging subtree */
    readonly segs: Segment[];
    /** ≈ salience fraction of the subtree (Σ 2r̂ dŝ) */
    readonly material: number;
    /**
     * position along the route's idealized outline (`outlineLenOf`), from
     * the route start's out-side contact point, walking in turn:
     *
     * * the out flank (where the position is `dist`)
     *
     * * the end cap
     *
     * * the back flank, back to the start
     *
     * * the start cap
     *
     * The position is continuous across the caps, so a flank child near a
     * route end and a terminal child there get nearby positions.
     */
    readonly outlinePos: number;
    /**
     * set for children at the route's end/start vertex: ordered by the
     * fork sweep (seam order) instead of dist/side
     */
    readonly terminal?: 'start' | 'end';
    /**
     * angle walked around the cap from the arriving flank's contact point
     * (`calcSweep`)
     *
     * * set only together with `terminal`, i.e. only for children at the
     *   route's end/start vertex
     */
    readonly sweep?: number;
}


export type { SegChild }
