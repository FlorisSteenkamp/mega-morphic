import type { CpNode } from "flo-mat";
import { isTerminating } from "flo-mat";


function getNonTerminatingOnCircle(
        cpNode: CpNode,
        exclThis = false) {

    const startCpNode = cpNode;
    let cpNode_ = startCpNode;

    const cpNodes: CpNode[] = [];
    do {
        if (!(exclThis && cpNode_ === startCpNode) && !isTerminating(cpNode_)) {
            cpNodes.push(cpNode_);
        }
        cpNode_ = cpNode_.nextOnCircle;
    } while (cpNode_ !== startCpNode)

    return cpNodes;
}


export { getNonTerminatingOnCircle }
