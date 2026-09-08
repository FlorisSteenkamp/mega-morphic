import { AppState } from './app-state.js';
import { TransientState } from './transient-state.js';
import { PageState } from './page-state.js';
import { createEmptyGeneratedSvgs, emptyDebugElems } from '../page/fs-consts-types/create-empty-generated-svgs.js';
import { DeducedState } from './deduced-state.js';
import { ToDraw } from './to-draw.js';
import { mapObj } from '../utils/map-obj.js';


const defaultTransientState: TransientState = {
    current: {
        cpNode: undefined!,
        nextElseAround: false,
        g: undefined!,
    },
    viewboxStack1: [],
    viewboxStack2: [],
    zoomState: { mouseIsDown: false, prevViewboxXY: [], zoomRect: undefined! },
    $svgs: createEmptyGeneratedSvgs(),
    $svgs2: createEmptyGeneratedSvgs(),
    // mats: undefined!
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
    bezierLoops2: []
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
    glyph1Name: 'Mt3',
    glyph2Name: 'Mu3',
    viewMat: true,
    simplify: false,
    showSvgs: [true, true, true],
}


const defaultAppState: AppState = {
    version: 4,
    pageState: defaultPageState
};


export { 
    defaultAppState, 
    defaultPageState, 
    defaultTransientState, 
    defaultDeduced 
}
