import type { CpNode } from 'flo-mat';
import type { BranchTree } from './branch-tree.js';
import { length } from 'flo-bezier3';
import { getBranch, getMatCurveToNext } from 'flo-mat';
import { getNonTerminatingOnCircle } from '../get-non-terminating-on-circle.js';
import { sum } from '../../utils/sum.js';


/**
 * Returns all branches associated with the given `CpNode` as a tree.
 * 
 * * the root of the tree is the first branch itself
 * * the branches emanating from its start and end are its children
 * 
 * * the final `CpNode` of each branch is not returned to improve symmetry
 * 
 * @param cpNode `CpNode` representing the start vertex.
 */
function getBranchTree(
        cpNode: CpNode): BranchTree {

    let root: BranchTree = undefined!;

    const stack: { cpNode: CpNode; parent: BranchTree | undefined }[] = [
        {
            cpNode: getBranch(cpNode)[0],
            parent: undefined
        }
    ];

    const takenBranches: Set<CpNode> = new Set();

    while (stack.length > 0) {
        const { cpNode, parent } = stack.pop()!;
        const branch = getBranch(cpNode);

        if (branch.length === 0) { continue; }

        const branchLength = sum(
            branch.map(cpNode => length([0, 1], getMatCurveToNext(cpNode)))
        );

        const node: BranchTree = {
            branch,
            length: branchLength,
            children: []
        };

        if (parent === undefined) {
            root = node;
        } else {
            parent.children.push(node);
        }

        const cpNodeS = branch[0];
        const cpNodeE = branch[branch.length - 1].next.prevOnCircle;

        takenBranches.add(cpNodeS);
        takenBranches.add(cpNodeE);

        const _cpNodesS = getNonTerminatingOnCircle(cpNodeS, true);
        const _cpNodesE = getNonTerminatingOnCircle(cpNodeE, true);
        const cpNodesS = _cpNodesS.filter(cpNode => !takenBranches.has(cpNode));
        const cpNodesE = _cpNodesE.filter(cpNode => !takenBranches.has(cpNode));

        for (const cpNode of cpNodesS) {
            takenBranches.add(cpNode);
        }
        for (const cpNode of cpNodesE) {
            takenBranches.add(cpNode);
        }

        for (const cpNode of cpNodesS) {
            stack.push({ cpNode, parent: node });
        }
        for (const cpNode of cpNodesE) {
            stack.push({ cpNode, parent: node });
        }
    }

    return root;
}


export { getBranchTree }
