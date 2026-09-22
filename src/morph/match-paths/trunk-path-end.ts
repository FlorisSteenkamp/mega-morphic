import type { FatBranchEdge } from '../fat-branch/fat-branch.js';
import type { PathGeom } from './path-geom.js';


/** A trunk path's start/end choice: own tip, or a child reroute. */
interface TrunkPathEnd {
    /** trunk skeleton knot index at which this endpoint is placed */
    readonly j: number;
    /** arc length from the trunk leaf tip to knot `j` */
    readonly jLen: number;
    /** child fork used to reroute into a descendant path, if any */
    readonly exit?: FatBranchEdge;
    /** descendant path geometry used by the reroute, if any */
    readonly sub?: PathGeom;
    /** round salience of trunk material bypassed by this endpoint choice */
    readonly stub: number;
}


export type { TrunkPathEnd }