import type { CpNode } from "flo-mat";
import { getMatCurveToNext, isTerminating } from "flo-mat";


/**
 * * **Debug only**
 * 
 * Returns the medial axis curves along a fat branch chain (both sides, so
 * each MAT edge appears twice - harmless for drawing).
 */
function getChainMatCurves(
        cpChain: CpNode[]): number[][][] {

    const pss: number[][][] = [];

    for (let i = 0; i < cpChain.length - 1; i++) {
        const cp = cpChain[i];

        // Same-circle jumps skip MAT subtrees; terminating steps are points.
        if (cpChain[i+1] === cp.next && !isTerminating(cp)) {
            pss.push(...getMatCurveToNext(cp));
        }
    }

    return pss;
}


export { getChainMatCurves }
