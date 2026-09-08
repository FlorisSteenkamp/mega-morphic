import type { Mat } from "flo-mat"
import type { BranchTree } from "../../morph/branch-tree/branch-tree.js";
import { getLargestVertex } from 'flo-mat';
import { getNearestCpNodeByMatCurve } from '../get-nearest/get-nearest-mat-curve.js';
import { getBranchTree } from '../../morph/branch-tree/get-branch-tree.js';
import { traverseBranchTree } from '../../morph/branch-tree/traverse-branch-tree.js';
import { drawBranchTree } from '../../draw-elem/draw-branch-tree.js';


function logBranch(mats: Mat[]) {
    return  function logBranch(g: SVGGElement, p: number[], showDelay?: number) {
        const cpNode = getNearestCpNodeByMatCurve(mats, p).t;
        const cpNodeLargest = getLargestVertex(cpNode);

        // Will be used in tests
        // console.log(JSON.stringify(toStringifyable(cpNodeLargest)));

        const tree = getBranchTree(cpNodeLargest);

        console.log(traverseBranchTree(cpNodeLargest, node => node.length));

        drawBranchTree(g, tree, 'thin50 red nofill', showDelay);

        for (const child of tree.children) {
            traverse(g, child, showDelay);
        }
    }
}


function traverse(g: SVGGElement, node: BranchTree, showDelay?: number) {
    drawBranchTree(g, node, 'thin20 blue nofill', showDelay);

    for (const child of node.children) {
        traverse(g, child, showDelay);
    }
}


export { logBranch }
