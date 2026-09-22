import type { CpNode } from "flo-mat";
import { getRealProngCount } from "flo-mat";


/**
 * Returns the 2-prong CpNode on the MAT's largest maximal disk - a canonical,
 * rotation-invariant rooting for `getFatBranchTree`: the largest disk is the
 * shape's most interior point (its radius is its boundary distance), so the
 * trunk passes through the core rather than whatever peripheral branch the
 * MAT traversal happened to start on.
 */
function getFattestCpNode(start: CpNode): CpNode {
    let best: CpNode | undefined;
    let cp = start;
    do {
        if (getRealProngCount(cp) === 2 &&
            (best === undefined ||
                cp.pointOnShape.circle.radius >
                best.pointOnShape.circle.radius)) {
            best = cp;
        }
        cp = cp.next;
    } while (cp !== start);

    return best ?? start;
}


export { getFattestCpNode }
