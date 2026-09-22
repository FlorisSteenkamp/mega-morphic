import type { CpNode } from "flo-mat";
import { isTerminating } from "flo-mat";


function getFirstLeafFrom(
        cpNode: CpNode) {

    let leaf = cpNode;
    while (!isTerminating(leaf)) {
        leaf = leaf.next;
        if (leaf === cpNode) {
            return undefined;  // looped MAT - no leaf - should be impossible
        }
    }

    return leaf;
}


export { getFirstLeafFrom }
