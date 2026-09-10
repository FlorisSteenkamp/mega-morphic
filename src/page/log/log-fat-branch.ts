import { drawFs } from 'flo-draw';
import { Mat } from 'flo-mat';
import { getNearestCpNode } from '../get-nearest/get-nearest-cp-node.js';
import { getFatBranch } from '../../morph/fat-branch/get-fat-branch.js';
import { getChainMatCurves } from '../../morph/fat-branch/get-chain-mat-curves.js';
import { getFatBranchesFrom } from '../../morph/fat-branch/get-fat-branches-from.js';
import { getFatBranchTree } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { drawFatBranch } from './draw-fat-branch.js';


function logFatBranch(
        mats: Mat[]) {

    return function(g: SVGGElement, p: number[], showDelay?: number) {
        const cpNode = getNearestCpNode(mats, p).t;

        const fatBranch = getFatBranchTree(cpNode);
        if (fatBranch === undefined) { return; }

        drawFatBranch(g, showDelay, fatBranch, false /* log? */);

        console.log(fatBranch);

        // const salience = fatBranch.roundSalience;
        // console.log(salience);
    }
}


export { logFatBranch }
