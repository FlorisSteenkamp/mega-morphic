import type { FatBranch } from "./fat-branch.js";
import { getSkeletonEdgeCps } from "./get-skeleton-cps.js";


/**
 * The maximal-disk radius at each skeleton segment boundary of the fat
 * branch's linear skeleton path (`getSkeletonBeziers` order; length =
 * segment count + 1).
 */
function getSkeletonRadii(
        fatBranch: FatBranch): number[] {

    const cps = getSkeletonEdgeCps(fatBranch);
    if (cps.length === 0) { return []; }

    return [
        cps[0].pointOnShape.circle.radius,
        ...cps.map(cp => cp.next.pointOnShape.circle.radius)
    ];
}


export { getSkeletonRadii }
