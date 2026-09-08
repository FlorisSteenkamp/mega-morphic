import { Mat } from "flo-mat";
import { closestPointOnBezier } from 'flo-bezier3';


function getClosestBezierInMats(
        mats: Mat[],
        p: number[]): number[][] {

    let bestPs: number[][] = undefined!;
    let bestDistance = Infinity;

    for (const mat of mats) {
        for (const loop of mat.meta.loops) {
            for (const ps of loop.beziers) {
                const { d } = closestPointOnBezier(ps, p);
                if (d < bestDistance) {
                    bestPs = ps;
                    bestDistance = d;
                }
            }
        }
    }

    return bestPs;
}


export { getClosestBezierInMats }
