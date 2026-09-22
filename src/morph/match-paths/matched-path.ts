import type { PathChildOp } from './path-child-op.js';
import type { PathPiece } from './path-piece.js';
import type { AlignStep } from './tail-align.js';


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


/** A matched pair of paths with its recursive sub-match. */
interface MatchedPath {
    /** composition recipe of the path in tree 1 (start → end) */
    readonly piecesA: PathPiece[];
    /** composition recipe of the path in tree 2 (start → end) */
    readonly piecesB: PathPiece[];
    /** total subtree match cost (shape + tails + stubs + children) */
    readonly cost: number;
    /** the profile-alignment (DTW) part alone */
    readonly shapeCost: number;
    /** the pooled-children alignment part alone */
    readonly childCost: number;
    /** unmatched start-side fraction of the composed path (retracts) */
    readonly tailA: number;
    readonly tailB: number;
    readonly children: PathChildOp[];
    /** set only when `_debug_` is active (full-resolution alignments) */
    readonly align?: PathAlignDebug;
}


export type { MatchedPath, PathAlignDebug }