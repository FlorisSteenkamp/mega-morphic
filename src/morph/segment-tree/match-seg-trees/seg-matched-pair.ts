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
    /** shape + child ops, recursive - a matched child at its full score
     *  (`scoreOf`: its cost + its sway) */
    readonly cost: number;
    /**
     * measured warp sway of the routes themselves
     *
     * * not part of the pair's own `cost`, but of every decision
     *   (`scoreOf`) - and of its parent's `cost`, through the parent's
     *   child price
     *
     * * a child pair's sway is scaled by its size (`calcSizeFactor`), so
     *   summed up the tree it charges each matched part by its material
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
