import type { CpNode, Mat } from 'flo-mat';
import type { DebugElems as DebugElemsBoolean } from 'flo-boolean';
import type { Debug as DebugMat } from 'flo-mat';
import type { Debug as DebugBooleanOp } from 'flo-boolean';
import type { PathMatchResult } from './path-match-result.js';
import type { TrunkCandDebug } from './record-trunk-cands.js';
import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { PathAlignDebug } from '../morph/match-paths/path-align-debug.js';


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
    /**
     * the child pair last evaluated by the child-DTW tool (at most one;
     * empty: the trunk pair) - shown by the needle window
     */
    childDtwPair: ChildDtwPair[];
}


/** A child pair as the child-DTW tool evaluated it, for the needle window. */
interface ChildDtwPair {
    /** the sub-pair whose children alignment is shown */
    readonly sub: SegMatchedPair;
    /** `sub` is the freshly priced sub-pair, not the match's own */
    readonly priced: boolean;
    /** the alignment the tool drew (its routes' DTW) - for the DTW window */
    readonly align: PathAlignDebug | undefined;
}


interface DebugMorph {
    elems: DebugElemsMorph;
}


type DebugElems = DebugElemsMat & DebugElemsBoolean & DebugElemsMorph;
type Debug = DebugMat & DebugBooleanOp & DebugMorph;


export { Debug, DebugElems, DebugElemsMat, DebugElemsMorph, ChildDtwPair }
