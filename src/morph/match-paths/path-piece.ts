import type { FatBranch } from '../fat-branch/fat-branch.js';


/**
 * One traversed piece of a composite path: an edge slice of a branch's
 * skeleton in its own orientation, optionally walked in reverse.
 */
interface PathPiece {
    readonly branch: FatBranch;
    /** slice start edge index (inclusive) */
    readonly fromEdge: number;
    /** slice end edge index (exclusive) */
    readonly toEdge: number;
    readonly reversed: boolean;
}


export type { PathPiece }