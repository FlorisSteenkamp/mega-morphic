import { chords } from "./chords.js";
import { wrapAngle } from "./wrap-angle.js";


/**
 * Returns an array of per-segment chord angles, *unwrapped* cumulatively
 * of the given array of bezier curves.
 * 
 * * the initial angle is the angle of the first chord relative to the x-axis
 * 
 * * adjacent segments differ by their true turning angle, never a ±2π
 * jump - a continuous angle profile along the skeleton.
 * 
 * * chords are the lines between the bezier curve endpoints
 */
function unwrappedChordAngles(
        pss: number[][][]): number[] {

    const { phi } = chords(pss);

    const out = [phi[0]];
    for (let i=0; i<phi.length - 1; i++) {
        out.push(out[i] + wrapAngle(phi[i + 1] - phi[i]));
    }

    return out;
}


export { unwrappedChordAngles }
