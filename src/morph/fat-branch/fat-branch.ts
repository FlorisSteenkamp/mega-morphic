import type { CpNode } from "flo-mat";


interface FatBranch {
    /** followed CpNodes */
    readonly cpChain: CpNode[];
    /** boundary bezier curves */
    readonly pss: number[][][];
    /** the region's round salience (its absolute area, including disk sectors) */
    readonly roundSalience: number;
    /** edges to child fat branches (set by `getFatBranchTree`) */
    children?: FatBranchEdge[];
}


interface FatBranchEdge {
    /** the child fat branch */
    readonly branch: FatBranch;
    /** skeleton arc length from the parent's leaf tip to the child's fork */
    readonly distanceFromLeaf: number;
    /** round salience of the parent piece between its leaf tip and the child's fork */
    readonly roundSalienceFromLeaf: number;
    /**
     * signed angle (radians, in (-π, π]) from the parent's travel direction
     * (away from its leaf tip) to the child's emanating MAT direction -
     * opposite signs for clockwise vs anti-clockwise
     */
    readonly angle: number;
}


export { FatBranch, FatBranchEdge }
