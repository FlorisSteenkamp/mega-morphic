import { drawFs } from "flo-draw";
import { Mat, CpNodeFs } from "flo-mat"
import { getNearestCpNodeByMatCurve } from '../get-nearest/get-nearest-mat-curve.js';


function logMatCurve(mats: Mat[]) {
    return function matCurve(g: SVGGElement, p: number[], showDelay?: number) {
        const cpNode = getNearestCpNodeByMatCurve(mats, p).t;

        const ps = CpNodeFs.getMatCurveToNext(cpNode);

        drawFs.bezier(g, ps, 'red thin20 nofill', showDelay);

        console.log(ps);
    }
}


export { logMatCurve }
