declare var _debug_: Debug; 
import type { Debug } from 'flo-mat';
import { getPathsFromStr, findMats, Mat } from 'flo-mat';
import { StateControl } from '../state-control/state-control';
import { updDebugGlobal } from './fs-consts-types/upd-debug-global';
import { getViewBoxForShape } from './fs-consts-types/viewbox';


const IS_DEBUG_ON = true;


function loadDeducedProps(
        stateControl: StateControl,
        pathStr1: string,
        pathStr2: string) {
    
    const bezierLoops1 = getPathsFromStr(pathStr1);
    const viewbox1 = getViewBoxForShape(bezierLoops1);
    const bezierLoops2 = getPathsFromStr(pathStr2);
    const viewbox2 = getViewBoxForShape(bezierLoops2);

    const timeStart = performance.now();

    let timingAll: number;
    let mats1: Mat[] = [];
    let mats2: Mat[] = [];

    // Resets _debug_
    updDebugGlobal(stateControl, IS_DEBUG_ON);

    const { state } = stateControl;
    const { appState } = state;
    const { pageState } = appState;
    const { viewMat, simplify, satScale } = pageState;

    try {
        const options = {
            applySat: !viewMat,
            simplify,
            satScale,
            maxCurviness: 0.25,
            maxLength: 100,
            angleIncrement: 15,
            simplifyTolerance: 2**-5
        };

        mats1 = findMats(bezierLoops1, options);
        mats2 = findMats(bezierLoops2, options);
    } catch (e) {
        console.log(e);
    } finally {
        timingAll = performance.now() - timeStart;
    }

    return { bezierLoops1, bezierLoops2, mats1, mats2, viewbox1, viewbox2, timingAll };
}


export { loadDeducedProps }
