import type { CpNode } from "flo-mat";


/**
 * Closes an open chain so the chain's first and last `CpNode`s are the same
 * `CpNode`.
 */
function closeChain(
        cpChain: CpNode[]): CpNode[] {

    return cpChain[0] === cpChain[cpChain.length - 1]
        ? cpChain
        : [...cpChain, cpChain[0]];
}


export { closeChain }
