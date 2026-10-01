import type { CpNode } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import { getRealProngCount } from "flo-mat";
import { getFatBranch } from "./get-fat-branch.js";
import { getFatBranchesFrom } from "./get-fat-branches-from.js";


/**
 * Returns the fat branch through the given `CpNode` as the trunk of a fully
 * recursive tree.
 */
function getFatBranchTree(
        cpNode: CpNode): FatBranch | undefined {

    // `getFatBranch` requires a plain 2-prong; walk to the nearest one.
    const cpStart = cpNode;
    while (getRealProngCount(cpNode) !== 2) {
        cpNode = cpNode.next;
        if (cpNode === cpStart) { return undefined; }
    }

    const fatTrunk = getFatBranch(cpNode);
    if (fatTrunk === undefined) { return undefined; }

    addChildren(fatTrunk);

    return fatTrunk;
}


/** Adds child `FatBranch`es to the given parent `FatBranch`, recursively. */
function addChildren(
        parent: FatBranch): void {

    for (const branch of getFatBranchesFrom(parent)) {
        parent.children.push(branch);
        addChildren(branch);
    }
}


export {
    getFatBranchTree
}
