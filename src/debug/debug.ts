import type { CpNode, Mat } from 'flo-mat';
import type { DebugElems as DebugElemsBoolean } from 'flo-boolean';
import type { Debug as DebugMat } from 'flo-mat';
import type { Debug as DebugBooleanOp } from 'flo-boolean';
import type { PathMatchResult } from '../morph/match-paths/path-match-result';
import type { FatBranch } from '../morph/fat-branch/fat-branch';


type DebugElemsMat = {
    oneProng: CpNode[];
    twoProng: CpNode[];
    threeProng: CpNode[];
    looseBoundingBox: number[][][];
    tightBoundingBox: number[][][];
    boundingHull: number[][][];
    vertex: CpNode[];
    mat: Mat[];
    maxVertex: CpNode[];
    leaves: CpNode[][];
    cull: number[][];
    cpNode: CpNode[];
    branch: CpNode[][];
    holeCloser: CpNode[];
}


type DebugElemsMorph = {
    pathMatchResult: PathMatchResult[];
    /** the matched tree pair, pushed in sync with `pathMatchResult` */
    matchTrees: { tree1: FatBranch; tree2: FatBranch }[];
}


interface DebugMorph {
    elems: DebugElemsMorph;
}


type DebugElems = DebugElemsMat & DebugElemsBoolean & DebugElemsMorph;
type Debug = DebugMat & DebugBooleanOp & DebugMorph;


export { Debug, DebugElems, DebugElemsMat, DebugElemsMorph }
