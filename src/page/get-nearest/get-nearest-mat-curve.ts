import { closestPointOnBezier } from 'flo-bezier3';
import { CpNodeFs, Mat } from "flo-mat";
import { getNearest } from '../../utils/get-nearest.js';


function getNearestCpNodeByMatCurve(
        mats: Mat[],
        p: number[]) {

    const cpNodes = mats.flatMap(mat => CpNodeFs.getAllOnLoop(mat.cpNode));
    
    return getNearest(
        (p, t) => closestPointOnBezier(CpNodeFs.getMatCurveToNext(t), p).d,
        cpNodes,
        p
    );
}


export { getNearestCpNodeByMatCurve }
