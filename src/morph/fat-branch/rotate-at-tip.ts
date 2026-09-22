import type { CpNode } from "flo-mat";
import { getSkeletonLengthDepths } from "./get-skeleton-length-depths.js";


/**
 * Rotates a closed chain so it starts (and ends) at the branch's leaf tip:
 * the node farthest from the chain start by skeleton arc - a leaf tip, since
 * depth peaks where the boundary walk turns around. Skeleton depths measured
 * on the result are then distances from that tip.
 */
function rotateAtTip(
        closedChain: CpNode[]): CpNode[] {

    const depths = getSkeletonLengthDepths(closedChain);

    let t = 0;
    for (let i = 1; i < depths.length; i++) {
        if (depths[i] > depths[t]) {
            t = i;
        }
    }
    if (t === 0) { return closedChain; }

    return [
        ...closedChain.slice(t),
        ...closedChain.slice(1, t + 1)
    ];
}


export { rotateAtTip }
