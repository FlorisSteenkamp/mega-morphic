import type { CpNode } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import { isOnSameCircle } from "flo-mat";
import { getChainsBetween } from "./get-chains-between.js";
import { getFattestOfChains } from "./get-fattest-of-chains.js";


/**
 * * **Debug only**
 * 
 * Returns the child fat branches of the given parent fat branch, i.e. one
 * maximal round salience fat branch per sector the parent skipped at a fork
 * (walked forward only - a child is a branch, not a trunk).
 *
 * * a child's `cpChain` is open (start and end contact on the fork circle);
 * its `pss` is closed across the fork disk by the sector arc reversed.
 */
function getFatBranchesFrom(
        parentBranch: FatBranch): FatBranch[] {

    const { cpChain } = parentBranch;
    const children: FatBranch[] = [];

    for (let i=0; i<cpChain.length - 1; i++) {
        const cp = cpChain[i];
        const cpNext = cpChain[i+1];

        // A skip jump; boundary steps and terminal pass-throughs are not.
        if (cpNext === cp.next || !isOnSameCircle(cp, cpNext)) {
            continue;
        }

        for (let s = cp; s !== cpNext; s = s.nextOnCircle) {
            const child = getFatBranchOfSector(s);
            if (child !== undefined) {
                children.push(child);
            }
        }
    }

    return children;
}


/**
 * * **Debug only**
 * 
 * Returns the maximal round salience fat branch of the sector from `s` to
 * `s.nextOnCircle` (forward direction only).
 */
function getFatBranchOfSector(
        s: CpNode): FatBranch | undefined {

    const sN = s.nextOnCircle;

    const chains = getChainsBetween(s, sN);
    return getFattestOfChains(chains, true);
}


export { getFatBranchesFrom }
