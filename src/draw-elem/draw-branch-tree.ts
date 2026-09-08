import type { BranchTree } from '../morph/branch-tree/branch-tree.js';
import { getMatCurveToNext } from 'flo-mat';
import { drawFs } from 'flo-draw';


/** Draws a single branch (the node's own branch, not its children). */
function drawBranchTree(
        g: SVGGElement,
        node: BranchTree,
        classes: string,
        showDelay?: number): void {

    for (const cpNode of node.branch) {
        drawFs.bezier(g, getMatCurveToNext(cpNode), classes, showDelay);
    }
}


export { drawBranchTree }
