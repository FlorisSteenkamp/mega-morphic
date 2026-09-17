import type { PathChildOp } from './path-child-op.js';
import type { PathPiece } from './path-piece.js';


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
    /** unmatched start-side fraction of the composed path (retracts) */
    readonly tailA: number;
    readonly tailB: number;
    readonly children: PathChildOp[];
}


export type { MatchedPath }