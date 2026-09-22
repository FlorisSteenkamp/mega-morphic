import type { CpNode } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import { getSkeletonEdgeCpPairs } from "./get-skeleton-edge-cp-pairs";


/**
 * The CpNodes whose MAT curves form the fat branch's linear skeleton path,
 * ordered from its leaf tip to its other end (each skeleton edge exactly
 * once).
 */
function getSkeletonEdgeCps(fatBranch: FatBranch): CpNode[] {
    return getSkeletonEdgeCpPairs(fatBranch).map(pair => pair.out);
}


export { getSkeletonEdgeCps }
