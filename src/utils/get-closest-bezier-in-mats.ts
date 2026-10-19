import { Mat } from "flo-mat";
import { closestPointOnBezier } from 'flo-bezier3';
import { getNearest } from './get-nearest.js';


/** The boundary bezier (of all the MATs' loops) nearest to `p`. */
function getClosestBezierInMats(
        mats: Mat[],
        p: number[]): number[][] {

    const beziers = mats.flatMap(mat => mat.meta.loops.flatMap(l => l.beziers));

    return getNearest(
        (p, ps) => closestPointOnBezier(ps, p).d,
        beziers,
        p
    ).t;
}


export { getClosestBezierInMats }
