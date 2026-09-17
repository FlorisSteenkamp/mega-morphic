import type { FatBranchEdge } from '../fat-branch/fat-branch.js';


/** A child fork lying ON a path (pooled across the path's pieces), with
 *  side/angle relative to the PATH's travel direction. */
interface PooledChild {
    readonly edge: FatBranchEdge;
    /** skeleton arc distance from the path's start end to the fork */
    readonly dist: number;
    readonly side: 1 | -1;
    readonly angle: number;
}


export type { PooledChild }