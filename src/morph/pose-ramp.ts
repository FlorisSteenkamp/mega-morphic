import type { Pose } from './procrustes/procrustes-analysis.js';

/**
 * The desired pose path of a morph: centroid on a straight line, scale
 * geometric, principal-axis angle at a constant rate from `thD0` to `thD1`.
 * `ths` are the MEASURED axis angles of the resolved (aligned-frame) morph
 * sampled uniformly over t and UNWRAPPED (period π, nearest branch between
 * adjacent samples) - so the draw-time correction needs no wrapping and can
 * never jump branches (the 180° mid-morph flip).
 */
interface PoseRamp {
    readonly c1: number[];
    readonly c2: number[];
    readonly s1: number;
    readonly s2: number;
    /** desired axis path endpoints; thD0 === ths[0], and thD1 is on the
     *  branch consistent with the unwrapped end sample */
    readonly thD0: number;
    readonly thD1: number;
    /** unwrapped measured axis angles at uniform t samples */
    readonly ths: number[];
}


/** The unwrapped measured axis angle at `t` (linear between samples). */
function measuredAngleAt(r: PoseRamp, t: number): number {
    const u = Math.max(0, Math.min(1, t)) * (r.ths.length - 1);
    const j = Math.min(r.ths.length - 2, Math.floor(u));
    const f = u - j;
    return r.ths[j]*(1 - f) + r.ths[j + 1]*f;
}


/**
 * The corrective similarity pinning the drawn shape onto the pose path at
 * `t`: centroid and scale from the LIVE measured pose (well-conditioned),
 * rotation = desired angle − precomputed unwrapped measured angle (plain
 * subtraction - no draw-time branch decision). Returns the point map and
 * its scale factor.
 */
function poseCorrectionAt(
        r: PoseRamp,
        t: number,
        measured: Pose): { tf: (p: number[]) => number[]; scale: number } {

    const cD = [
        (1 - t)*r.c1[0] + t*r.c2[0],
        (1 - t)*r.c1[1] + t*r.c2[1]
    ];
    const sD = Math.pow(r.s1, 1 - t) * Math.pow(r.s2, t);
    const thD = r.thD0 + t*(r.thD1 - r.thD0);

    const rot = thD - measuredAngleAt(r, t);

    const s = sD / measured.scale;
    const c = Math.cos(rot);
    const n = Math.sin(rot);
    const [mx, my] = measured.centroid;

    return {
        tf: ([x, y]) => {
            const ux = x - mx;
            const uy = y - my;
            return [
                cD[0] + s*(c*ux - n*uy),
                cD[1] + s*(n*ux + c*uy)
            ];
        },
        scale: s
    };
}


export { poseCorrectionAt }
export type { PoseRamp }
