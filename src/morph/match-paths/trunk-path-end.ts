import type { FatBranchEdge } from '../fat-branch/fat-branch.js';
import type { PathGeom } from './path-geom.js';


/** A trunk path's start/end choice: own tip, or a child reroute. */
interface TrunkPathEnd {
    readonly j: number;
    readonly jLen: number;
    readonly exit?: FatBranchEdge;
    readonly sub?: PathGeom;
    readonly stub: number;
}


export type { TrunkPathEnd }