import type { CpNode } from "flo-mat";


/**
 * * **Debug only**
 * 
 * * for visualization / debug purposes only
 * * not used in actual morphing algorithm
 */
interface FatBranch {
    /** followed CpNodes */
    readonly cpChain: CpNode[];
    /** boundary bezier curves */
    readonly pss: number[][][];
    /** child fat branches (set by `getFatBranchTree`) */
    readonly children: FatBranch[];
}


export { FatBranch }
