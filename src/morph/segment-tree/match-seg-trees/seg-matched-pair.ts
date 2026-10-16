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
    readonly ops: SegOp[];
    /** set only when `_debug_` is active: per-side child-alignment DP */
    readonly dp?: SegDp[];
    /**
     * set only when `_debug_` is active: full-resolution profile alignment
     * of the routes (attached by `recordPathMatch`)
     */
    readonly align?: PathAlignDebug;
}


export type { SegMatchedPair }
