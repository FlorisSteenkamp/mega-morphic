import { CpNode, CpNodeFs, Mat } from "flo-mat";
import { distanceBetween } from "flo-vector2d";
import { getNearest } from '../../utils/get-nearest.js';


function getNearestCpNode(
        mats: Mat[],
        p: number[]) {

    const cpNodes = mats.flatMap(mat => CpNodeFs.getAllOnLoop(mat.cpNode));
    
    return getNearest(
        (p, t) => distanceBetween(p, t.pointOnShape.p),
        cpNodes,
        p
    );
}


export { getNearestCpNode }
