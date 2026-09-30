import type { PathChildOp } from './path-child-op.js';
import type { AlignStep } from './tail-align.js';
import type { PooledChild } from './pooled-child.js';
import type { SeqOp } from './align-seq.js';
import type { RouteStep } from '../segment-graph/segment.js';


/** Debug-only: one side's pooled-children DP (Needleman-Wunsch) data. */
interface PooledDp {
    readonly side: 1 | -1;
    /** (nA+1) × (nB+1) scoring matrix */
    readonly D: number[][];
    /** the side's pooled children in alignment order */
    readonly as: PooledChild[];
    readonly bs: PooledChild[];
    /** traceback, start → end */
    readonly ops: SeqOp<PooledChild, PooledChild>[];
}


/** Debug-only visualization data of a pair's profile alignment. */
interface PathAlignDebug {
    /** normalized sample positions along each path */
    readonly usA: number[];
    readonly usB: number[];
    readonly skelPssA: number[][][];
    readonly skelPssB: number[][][];
    readonly radiiA: number[];
    readonly radiiB: number[];
    /** full DTW traceback, start → end */
    readonly steps: AlignStep[];
}


/** The cost decomposition of a matched path pair. */
interface MatchCost {
    /** total subtree match cost (shape + tails + stubs + children) */
    readonly totalCost: number;
    /** the profile-alignment (DTW) part alone */
    readonly shapeCost: number;
    /** the pooled-children alignment part alone */
    readonly childCost: number;
}


/** A matched pair of paths with its recursive sub-match. */
interface MatchedPath {
    /** the path's route in tree 1's segment graph (start → end) */
    readonly routeA: RouteStep[];
    /** the path's route in tree 2's segment graph (start → end) */
    readonly routeB: RouteStep[];

    readonly cost: MatchCost;
    /** unmatched start-side fraction of the composed path (retracts) */
    readonly tailA: number;
    readonly tailB: number;

    readonly children: PathChildOp[];

    /** set only when `_debug_` is active (full-resolution alignments) */
    readonly align?: PathAlignDebug;
    /** set only when `_debug_` is active: per-side pooled-children DP */
    readonly pooledDp?: PooledDp[];
}


export type { MatchedPath, MatchCost, PathAlignDebug, PooledDp }