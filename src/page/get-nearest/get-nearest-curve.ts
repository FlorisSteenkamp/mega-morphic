import { closestPointOnBezier } from "flo-bezier3";
import { CpNode, CpNodeFs, Mat } from "flo-mat";
import { distanceBetween } from "flo-vector2d";
import { getNearest } from '../../utils/get-nearest.js';


function getNearestCurve(
        mats: Mat[],
        p: number[]) {

    const curves = mats.flatMap(mat => mat.meta.loops.flatMap(l => l.curves));
    
    return getNearest(
        (p, curve) => closestPointOnBezier(curve.ps, p).d,
        curves,
        p
    );
}


export { getNearestCurve }
