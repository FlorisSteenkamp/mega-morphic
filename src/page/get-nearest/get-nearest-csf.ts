import { CpNode, CpNodeFs, Mat } from "flo-mat";
import { distanceBetween } from "flo-vector2d";
import { getNearest } from '../../utils/get-nearest.js';


function getNearestCsf(
        mats: Mat[],
        p: number[]) {

    // const csfs = mats.flatMap(mat => mat.meta.csfs);
    
    // return getNearest(
    //     (p, csf) => distanceBetween(p, csf.circle.center),
    //     csfs,
    //     p
    // );
}


export { getNearestCsf }
