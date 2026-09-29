declare var _debug_: Debug; 
import type { Debug } from '../debug/debug.js';
import { getPathsFromStr, findMats, Mat } from 'flo-mat';
import { reverseShapeOrientation } from 'flo-boolean';
import { StateControl } from '../state-control/state-control';
import { updDebugGlobal } from './fs-consts-types/upd-debug-global';
import { getViewBoxForShape } from './fs-consts-types/viewbox';
import { beziersToSvgPathStr } from 'flo-boolean';


const IS_DEBUG_ON = true;


function loadDeducedProps(
        stateControl: StateControl,
        pathStr1: string,
        pathStr2: string) {

    const { state } = stateControl;
    const { appState } = state;
    const { pageState } = appState;
    const { viewMat, simplify, satScale, rot1, flipH, flipV } = pageState;

    const bezierLoops1 = rotateLoops(
        flipLoops(getPathsFromStr(pathStr1), flipH, flipV),
        rot1
    );

    // console.log(beziersToSvgPathStr(bezierLoops1[0]))
    const viewbox1 = getViewBoxForShape(bezierLoops1);
    const bezierLoops2 = getPathsFromStr(pathStr2);
    const viewbox2 = getViewBoxForShape(bezierLoops2);

    const timeStart = performance.now();

    let timingAll: number;
    let mats1: Mat[] = [];
    let mats2: Mat[] = [];

    // Resets _debug_
    updDebugGlobal(stateControl, IS_DEBUG_ON);

    try {
        const options = {
            applySat: !viewMat,
            simplify,
            satScale,
            maxCurviness: 0.25,
            maxLength: 10,
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


/** Mirrors all loops about their bbox center's vertical and/or horizontal
 *  axis (testing); a single mirror reverses orientation, so windings are
 *  re-reversed then (both mirrors = 180° rotation, orientation preserved). */
function flipLoops(
        loops: number[][][][],
        flipH: boolean,
        flipV: boolean): number[][][][] {

    if (!flipH && !flipV) { return loops; }

    const [[minX, minY], [maxX, maxY]] = getViewBoxForShape(loops);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const flipped = loops.map(loop => loop.map(ps => ps.map(([x, y]) => [
        flipH ? 2*cx - x : x,
        flipV ? 2*cy - y : y
    ])));

    return flipH !== flipV
        ? flipped.map(loop => reverseShapeOrientation(loop))
        : flipped;
}


/** Rotates all loops' control points about their bbox center (testing). */
function rotateLoops(
        loops: number[][][][],
        degrees: number): number[][][][] {

    if (degrees % 360 === 0) { return loops; }

    const [[minX, minY], [maxX, maxY]] = getViewBoxForShape(loops);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const θ = degrees * Math.PI / 180;
    const c = Math.cos(θ);
    const s = Math.sin(θ);

    return loops.map(loop => loop.map(ps => ps.map(([x, y]) => [
        cx + c*(x - cx) - s*(y - cy),
        cy + s*(x - cx) + c*(y - cy)
    ])));
}


export { loadDeducedProps }
