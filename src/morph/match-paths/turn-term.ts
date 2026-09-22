import type { PathGeom } from "./path-geom.js";
import { getPolyBezierTurningAngle } from './get-poly-bezier-turning-angle.js';

const { abs, PI: π } = Math;


/**
 * Returns `turnWeight` * (the absolute difference in turning angle between the
 * two given `PathGeom`s) / `π`
 * 
 * * i.e., a 180 degree turn imposes a penalty of `1` times `turnWeight`
 * 
 * @param turnWeight
 */
function turnTerm(
        turnWeight: number) {

    return function(
        pA: PathGeom,
        pB: PathGeom): number {

        return turnWeight * abs(
            getPolyBezierTurningAngle(pA.skelPss) - 
            getPolyBezierTurningAngle(pB.skelPss)
        ) / π;
    }
}


export { turnTerm }
