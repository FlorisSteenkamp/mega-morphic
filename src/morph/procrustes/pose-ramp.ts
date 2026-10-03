import type { PoseOptions } from './pose-options.js';
import type { Pose } from './pose.js';


/**
 * The desired pose path of a morph: centroid on a straight line, scale
 * geometric. Rotation needs no pin - the intrinsic skeleton lerp already
 * plays orientation out linearly, and whole-turn surplus is handled by the
 * no-net-rotation gauge (getMorphedSkeleton).
 */
interface PoseRamp {
    readonly c1: number[];
    readonly c2: number[];
    readonly s1: number;
    readonly s2: number;
}


/**
 * The corrective scale+translation pinning the drawn shape onto the pose
 * path at `t`: centroid and scale from the LIVE measured pose
 * (well-conditioned - the seam bias cancels against the ramp's same-metric
 * endpoints).
 */
function poseCorrectionAt(
        poseOptions: PoseOptions,
        r: PoseRamp,
        t: number,
        measured: Pose): { tf: (p: number[]) => number[]; scale: number } {

    const { applyCentroid, applyScale } = poseOptions;

    // disabled components pin to the MEASURED value = no correction
    const cD = applyCentroid
        ? [(1 - t)*r.c1[0] + t*r.c2[0], (1 - t)*r.c1[1] + t*r.c2[1]]
        : measured.centroid;
    const sD = applyScale
        ? Math.pow(r.s1, 1 - t) * Math.pow(r.s2, t)
        : measured.scale;

    const s = sD / measured.scale;
    const [mx, my] = measured.centroid;

    return {
        tf: ([x, y]) => [
            cD[0] + s*(x - mx),
            cD[1] + s*(y - my)
        ],
        scale: s
    };
}


export { poseCorrectionAt }
export type { PoseRamp }
