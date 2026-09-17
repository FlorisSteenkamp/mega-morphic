import type { CpNode } from "flo-mat";
import type { FatBranch } from './fat-branch.js';
import { getRealProngCount } from "flo-mat";
import { getShapeArea } from "flo-boolean";
import { getFatSaliencePss } from "./get-fat-salience.js";
import { getChainsBetween } from './get-chains-between.js';


function getFatBranch(
        cpNode: CpNode): FatBranch | undefined {

    if (getRealProngCount(cpNode) !== 2) {
        return undefined;
    }

    const cpStart = cpNode;
    const cpOpp = cpNode.prevOnCircle;

    // The boundary from cpStart to cpOpp covers one side of the branch (out
    // along one side and back along the other); continuing from cpOpp back to
    // cpStart covers the opposite half, closing the outline through the
    // starting disk's two contact points.
    const chainsOut = getChainsBetween(cpStart, cpOpp);
    const chainsBack = getChainsBetween(cpOpp, cpStart);

    let bestChain: CpNode[] | undefined;
    let bestPss: number[][][] | undefined;
    let bestSalience = -Infinity;

    for (const chainOut of chainsOut) {
        for (const chainBack of chainsBack) {
            const cpChain = [...chainOut, ...chainBack.slice(1)];
            const pss = getFatSaliencePss(cpChain);
            const salience = Math.abs(getShapeArea(pss));

            if (salience > bestSalience) {
                bestSalience = salience;
                bestChain = cpChain;
                bestPss = pss;
            }
        }
    }

    if (bestChain === undefined) {
        return undefined;
    }

    return { cpChain: bestChain, pss: bestPss!, roundSalience: bestSalience };
}


export { getFatBranch }
