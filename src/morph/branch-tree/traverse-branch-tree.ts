import { CpNode } from "flo-mat";
import { BranchTree } from "./branch-tree";
import { getBranchTree } from "./get-branch-tree";

/**
 * Traverses the branch tree rooted at the given `cpNode`, calling `f` on each
 * tree node and returning the collected results.
 * 
 * @param cpNode `CpNode` representing the start vertex.
 * @param f called on each `BranchTree` node; its return value is collected.
 */
function traverseBranchTree<T>(
        cpNode: CpNode,
        f: (node: BranchTree) => T): T[] {

    const results: T[] = [];

    (function visit(node: BranchTree) {
        results.push(f(node));
        for (const child of node.children) { visit(child); }
    })(getBranchTree(cpNode));

    return results;
}


export { traverseBranchTree }
