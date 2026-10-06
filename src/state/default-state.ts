import { AppState } from './app-state.js';
import { TransientState } from './transient-state.js';
import { PageState } from './page-state.js';
import { createEmptyGeneratedSvgs, emptyDebugElems } from '../page/fs-consts-types/create-empty-generated-svgs.js';
import { DeducedState } from './deduced-state.js';
import { ToDraw } from './to-draw.js';
import { mapObj } from '../utils/map-obj.js';
import { defaultPathWeights } from '../morph/match-paths/path-cost-weights.js';


const defaultTransientState: TransientState = {
    current: {
        cpNode: undefined!,
        nextElseAround: false,
        g: undefined!,
    },
    viewboxStack1: [],
    viewboxStack2: [],
    viewboxStack3: [],
    zoomState: { mouseIsDown: false, prevViewboxXY: [], zoomRect: undefined! },
    $svgs: createEmptyGeneratedSvgs(),
    $svgs2: createEmptyGeneratedSvgs(),
}


const defaultToDraw: ToDraw = {
    ...mapObj(() => false, emptyDebugElems),
    mat: true,
} as ToDraw;


const defaultDeduced: DeducedState = {
    pathStr1: '',
    mats1: [],
    pathStr2: '',
    mats2: [],
    bezierLoops1: [],
    bezierLoops2: [],
    morphPose: undefined!
}

const defaultPageState: PageState = {
    deduced: defaultDeduced,
    showDelay: 1000,
    clickFor: 'twoProng',
    satScale: 1.5,
    // @ts-ignore
    toDraw: defaultToDraw,
    viewbox1: [[0,0],[1450,1450]],
    viewbox2: [[0,0],[1450,1450]],
    viewbox3: [[0,0],[1450,1450]],
    glyph1Name: 'Mt3',
    glyph2Name: 'Mu3',
    viewMat: true,
    simplify: false,
    showSvgs: [true, true, true],
    showWeights: true,
    morphFillOnly: false,
    showPose: false,
    showMatch: false,
    showMatchBoundary: false,
    showMorphBounds: false,
    showBranchNums: false,
    rot1: 0,
    flipH: false,
    flipV: false,
    pathWeights: defaultPathWeights,
    morphT: 0
}


const defaultAppState: AppState = {
    // v5: pathWeights.shape split into radius + turning
    version: 5,
    pageState: defaultPageState
};


export { 
    defaultAppState, 
    defaultPageState, 
    defaultTransientState, 
    defaultDeduced 
}


// {"version":4,"pageState":{"showDelay":1000,"clickFor":"twoProng","satScale":1.5,"toDraw":{"oneProng":false,"twoProng":false,"threeProng":false,"looseBoundingBox":false,"tightBoundingBox":false,"boundingHull":false,"vertex":false,"mat":true,"maxVertex":false,"leaves":false,"cull":false,"cpNode":false,"branch":false,"holeCloser":false},"viewbox1":[[-3.2017070225307407,-158.14453193119607],[381.40747615269254,486.29604598454057]],"viewbox2":[[-74.27513227513236,-153.81568287037055],[347.4444444444441,516.4964864417988]],"viewbox3":[[-43.201058201058174,-158.25483630952397],[442.88624338624334,500.9594494047618]],"glyph1Name":"parenleft","glyph2Name":"parenright","viewMat":true,"simplify":false,"showSvgs":[true,true,true]}}