import { Mat } from 'flo-mat';
import { getNearestCpNode } from '../get-nearest/get-nearest-cp-node.js';
import { getFatBranchTree } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { drawFatBranch } from './draw-fat-branch.js';


function logFatBranch(
        mats: Mat[]) {

    return function(g: SVGGElement, p: number[], showDelay?: number) {
        const cpNode = getNearestCpNode(mats, p).t;
        // const cpNode = mats[0].cpNode;

        const fatBranch = getFatBranchTree(cpNode);
        if (fatBranch === undefined) { return; }

        drawFatBranch(g, showDelay, fatBranch, false /* log? */);

        console.log(fatBranch);
        // const salience = fatBranch.roundSalience;
        // console.log(salience);
    }
}


export { logFatBranch }
