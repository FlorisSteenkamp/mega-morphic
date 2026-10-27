import { wrapAngle } from './wrap-angle.js';
import { chords$ } from './chords.js';
import { toChordFrame } from '../fs/to-chord-frame.js';

const { cos, sin } = Math;


/**
 * Interpolates two corresponding skeleton bezier lists intrinsically: the
 * initial angle, per-knot turning angles and per-segment chord lengths are
 * interpolated (instead of control points) and the skeleton reconstructed by
 * integration from the lerped start point - so it bends through natural
 * intermediate poses instead of collapsing through straight-line blends.
 * Each segment's curve shape is lerped in its chord frame on top.
 * Exact at t=0 and t=1.
 *
 * @param a the skeleton beziers in frame a
 * @param b the corresponding skeleton beziers in frame b
 * @param t the morph parameter (start point, chord lengths, curve shapes)
 * @param s the angles' progress (`calcAngleProgress`)
 */
function intrinsicSkeletonLerp(
        a: number[][][],
        b: number[][][],
        t: number,
        s: number): number[][][] {

    const n = a.length;
    if (n === 0) { return []; }

    const cA = chords$(a);
    const cB = chords$(b);

    // Absolute chord angles: initial angle the short way round, turning
    // angles (already wrapped) lerped linearly.
    const phis: number[] = [cA.phi[0] + s*wrapAngle(cB.phi[0] - cA.phi[0])];
    for (let k = 1; k < n; k++) {
        const dA = wrapAngle(cA.phi[k] - cA.phi[k - 1]);
        const dB = wrapAngle(cB.phi[k] - cB.phi[k - 1]);
        phis.push(phis[k - 1] + (1 - s)*dA + s*dB);
    }

    let px = a[0][0][0]*(1 - t) + b[0][0][0]*t;
    let py = a[0][0][1]*(1 - t) + b[0][0][1]*t;

    const out: number[][][] = [];
    for (let k = 0; k < n; k++) {
        const L = cA.L[k]*(1 - t) + cB.L[k]*t;
        const bx = L*cos(phis[k]);
        const by = L*sin(phis[k]);

        // control points in the segment's own chord frame
        const psA = a[k];
        const psB = b[k];
        const qA = toChordFrame(psA, psA[0], psA[psA.length - 1]);
        const qB = toChordFrame(psB, psB[0], psB[psB.length - 1]);

        out.push(qA.map((q, j) => {
            const qx = q[0]*(1 - t) + qB[j][0]*t;
            const qy = q[1]*(1 - t) + qB[j][1]*t;
            return [px + bx*qx - by*qy, py + by*qx + bx*qy];
        }));

        px += bx;
        py += by;
    }

    return out;
}


export { intrinsicSkeletonLerp }
