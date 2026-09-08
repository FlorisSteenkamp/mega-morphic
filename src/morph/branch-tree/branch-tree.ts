import type { CpNode } from 'flo-mat';


/**
 * A node in the branch tree.
 */
type BranchTree = {
    /** holds the `CpNode`s of the branch */
    readonly branch: CpNode[];
    /** holds the total length of the branch's mat curve */
    readonly length: number;
    /** holds the branches emanating from this branch's start and end */
    readonly children: BranchTree[];
}


export { BranchTree }
