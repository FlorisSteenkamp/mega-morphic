import type { CpNode } from "flo-mat";
import { getCircleId } from "./get-circle-id";


/**
 * Direction-independent key of the skeleton edge between adjacent disks.
 */
function getEdgeKey(
        cp1: CpNode,
        cp2: CpNode): string {

    const id1 = getCircleId(cp1);
    const id2 = getCircleId(cp2);

    return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
}


export { getEdgeKey }