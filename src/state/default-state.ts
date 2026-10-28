import type { AppState } from './app-state.js';
import type { TransientState } from './transient-state.js';
import type { PageState } from './page-state.js';
import type { DeducedState } from './deduced-state.js';
import type { ToDraw } from './to-draw.js';
import { createEmptyGeneratedSvgs } from '../page/fs-consts-types/create-empty-generated-svgs.js';
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


/** only the match is drawn initially */
const defaultToDraw = Object.fromEntries(
    toDrawKeys.map(k => [k, k === 'match'])
) as ToDraw;


const defaultDeduced: DeducedState = {
    pathStr1: '',
    mats1: [],
    pathStr2: '',
    mats2: [],
    coarseMats1: [],
    coarseMats2: [],
    bezierLoops1: [],
    bezierLoops2: [],
    morphPose: undefined!
}

const defaultPageState: PageState = {
    deduced: defaultDeduced,
    showDelay: 1000,
    clickFor: undefined,
    satScale: 2,
    toDraw: defaultToDraw,
    viewbox1: [[0,0],[1450,1450]],
    viewbox2: [[0,0],[1450,1450]],
    viewbox3: [[0,0],[1450,1450]],
    glyph1Name: 'zoo-horse',
    glyph2Name: 'zoo-cat',
    glyphPresets: [
        ['zoo-horse', 'zoo-cat'], ['k', 'x'], ['seven', 'three']
    ],
    // Leave these alone
    // glyphPresets: [
    //     ['M', 'N'], ['T', 'A'], ['k', 'x'], ['E', 'F'],
    //     ['six', 'seven'], ['C', 'B'], ['A', 'H'], ['seven', 'three'],
    //     ['v', 'Q_V'], ['parenleft', 'parenright'], ['an_one', 'aq_J'],
    //     ['five', 'six']
    // ],
    viewMat: true,
    staggeredSat: true,
    simplify: false,
    showSvgs: [false, true, true],
    showDebug: false,
    morphFillOnly: true,
    morphPattern: false,
    showPose: false,
    rot1: 0,
    flipH: false,
    flipV1: true,
    flipV2: true,
    pathWeights: defaultPathWeights,
    morphT: 0,
    morphSpeed: 1,
    morphPlaying: true
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
