import type { Pose } from './pose.js';
import type { Placement } from './calc-placement.js';


/**
 * The desired pose path of a morph: centroid on a straight line, scale
 * geometric. Rotation needs no pin - the intrinsic skeleton lerp already
 * plays orientation out linearly, and whole-turn surplus is handled by the
 * no-net-rotation gauge (getMorphedSkeleton$).
 */
interface PoseRamp {
    /** the measured pose at t=0 */
    readonly poseA: Pose;
    /** the measured pose at t=1 */
    readonly poseB: Pose;
}


/**
 * The corrective scale+translation pinning the drawn shape onto the pose
 * path at `t`: centroid and scale from the LIVE measured placement
 * (`calcPlacement` - well-conditioned: the seam bias cancels against the
 * ramp's same-metric endpoints).
 */
function poseCorrectionAt(
        r: PoseRamp,
        t: number,
        measured: Placement): (p: number[]) => number[] {

    const { poseA, poseB } = r;
    const [cAx, cAy] = poseA.centroid;
    const [cBx, cBy] = poseB.centroid;
    const { scale: sA } = poseA;
    const { scale: sB } = poseB;
    const [mx, my] = measured.centroid;

    // desired centroid (straight line) and scale (geometric)
    const cDx = (1 - t)*cAx + t*cBx;
    const cDy = (1 - t)*cAy + t*cBy;
    const sD = Math.pow(sA, 1 - t) * Math.pow(sB, t);

    const s = sD / measured.scale;

    return ([x, y]) => [
        cDx + s*(x - mx),
        cDy + s*(y - my)
    ];
}


export { poseCorrectionAt }
export type { PoseRamp }
