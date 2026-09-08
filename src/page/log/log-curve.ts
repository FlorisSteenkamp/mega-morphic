import { drawFs } from 'flo-draw';
import { Mat } from 'flo-mat';
import { getNearestCurve } from '../get-nearest/get-nearest-curve.js';


function logCurve(mats: Mat[]) {
    return function logK(g: SVGGElement, p: number[], showDelay?: number) {
        const curve = getNearestCurve(mats, p).t;
        drawFs.bezier(g, curve.ps, undefined, showDelay);
        console.log(curve);
    }
}


export { logCurve }