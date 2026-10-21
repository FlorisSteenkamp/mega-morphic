import { AppState } from './app-state.js';
import { TransientState } from './transient-state.js';
import { PageState } from './page-state.js';
import { createEmptyGeneratedSvgs } from '../page/fs-consts-types/create-empty-generated-svgs.js';
import { DeducedState } from './deduced-state.js';
import type { ToDraw } from './to-draw.js';
import { toDrawKeys } from './to-draw.js';
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


/** only the MAT is drawn initially */
const defaultToDraw = Object.fromEntries(
    toDrawKeys.map(k => [k, k === 'mat'])
) as ToDraw;


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
    toDraw: defaultToDraw,
    viewbox1: [[0,0],[1450,1450]],
    viewbox2: [[0,0],[1450,1450]],
    viewbox3: [[0,0],[1450,1450]],
    glyph1Name: 'Mt3',
    glyph2Name: 'Mu3',
    glyphPresets: [['M', 'N'], ['k', 'x']],
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
