import type { CpNode, Mat } from 'flo-mat';
import type { DebugElems as DebugElemsBoolean } from 'flo-boolean';
import type { Debug as DebugMat } from 'flo-mat';
import type { Debug as DebugBooleanOp } from 'flo-boolean';
import type { PathMatchResult } from './path-match-result.js';
import type { TrunkCandDebug } from './record-trunk-cands.js';


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
    /** the trunk re-rank table of the latest match */
    trunkCands: TrunkCandDebug[];
}


interface DebugMorph {
    elems: DebugElemsMorph;
}


type DebugElems = DebugElemsMat & DebugElemsBoolean & DebugElemsMorph;
type Debug = DebugMat & DebugBooleanOp & DebugMorph;


export { Debug, DebugElems, DebugElemsMat, DebugElemsMorph }
