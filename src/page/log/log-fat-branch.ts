import type { Mat } from 'flo-mat';
import { getNearestCpNode } from '../get-nearest/get-nearest-cp-node.js';
import { getFatBranchTree } from './fat-branch/get-fat-branch-tree.js';
import { drawFatBranchTree } from './draw-fat-branch.js';


function logFatBranch(
        mats: Mat[],
        fullTree: boolean) {

    return function(g: SVGGElement, p: number[], showDelay?: number) {
        const cpNode = getNearestCpNode(mats, p).t;

        const fatBranchTree = getFatBranchTree(cpNode);
        if (fatBranchTree === undefined) { return; }

        drawFatBranchTree(g, showDelay, fatBranchTree, fullTree);

        console.log(fatBranchTree);
    }
}


export { logFatBranch }
