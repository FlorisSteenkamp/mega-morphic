import type { RouteStep } from '../segment.js';
import type { PathAlignDebug } from '../../match-paths/path-align-debug.js';
import type { SegOp } from './seg-op.js';
import type { SegDp } from './seg-dp.js';


/** A matched route pair with its recursive sub-matches. */
interface SegMatchedPair {
    /** travel order: trunk leaf→leaf; children tip→junction (as pathsOf) */
    readonly routeA: RouteStep[];
    readonly routeB: RouteStep[];
    readonly shapeCost: number;
    /** shape + child ops, recursive */
    readonly cost: number;
    /**
     * measured warp sway of the routes themselves
     *
     * * never part of `cost`, but part of every decision (`scoreOf`)
     *
     * * not summed over the children: it is a mean over the routes'
     *   corresponded material (size-independent), so a sum would charge
     *   every matched part a full share however small - each child's own
     *   sway already priced its match, one level up
     */
    readonly sway: number;
    readonly ops: SegOp[];
    /** set only when `_debug_` is active: the child-alignment DP */
    readonly dp?: SegDp;
    /**
     * set only when `_debug_` is active: full-resolution profile alignment
     * of the routes (attached by `recordPathMatch`)
     */
    readonly align?: PathAlignDebug;
}


export type { SegMatchedPair }
