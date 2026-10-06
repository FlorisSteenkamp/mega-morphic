import type { CpNode } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import { getShapeArea } from "flo-boolean";
import { getChainPss } from "./get-chain-pss.js";

const { abs } = Math;


/**
 * * **Debug only**
 * 
 * Returns the highest round salience candidate among the given chains as a
 * childless `FatBranch` (or `undefined` if there are no chains).
 *
 * @param chains candidate chains
 * @param invertCap set to `true` to invert the endcap (typically for branches),
 * else set to `false` (e.g. for the trunk)
 */
function getFattestOfChains(
        chains: CpNode[][],
        invertCap: boolean): FatBranch | undefined {

    let bestChain: CpNode[] | undefined;
    let bestPss: number[][][] | undefined;
    let bestSalience = -Infinity;

    for (const chain of chains) {
        const cpChain = chain;
        const pss = getChainPss(cpChain, invertCap);
        const salience = abs(getShapeArea(pss));

        if (salience > bestSalience) {
            bestSalience = salience;
            bestChain = cpChain;
            bestPss = pss;
        }
    }

    if (bestChain === undefined) {
        return undefined;
    }

    return {
        cpChain: bestChain,
        pss: bestPss!,
        children: []
    };
}


export { getFattestOfChains }
