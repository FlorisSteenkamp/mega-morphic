import type { CpNode, Mat } from 'flo-mat';
import type { DebugElems as DebugElemsBoolean } from 'flo-boolean';
import type { Debug as DebugMat } from 'flo-mat';
import type { Debug as DebugBooleanOp } from 'flo-boolean';


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


type DebugElems = DebugElemsMat & DebugElemsBoolean;
type Debug = DebugMat & DebugBooleanOp;


export { Debug, DebugElems, DebugElemsMat }
