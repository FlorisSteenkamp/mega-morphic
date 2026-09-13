const { atan2, cos, sin, hypot, PI: π } = Math;

const EPS = 1e-9;


/**
 * Interpolates two corresponding skeleton bezier lists intrinsically: the
 * initial angle, per-knot turning angles and per-segment chord lengths are
 * interpolated (instead of control points) and the skeleton reconstructed by
 * integration from the lerped start point - so it bends through natural
 * intermediate poses instead of collapsing through straight-line blends.
 * Each segment's curve shape is lerped in its chord frame on top.
 * Exact at t=0 and t=1.
 */
function intrinsicSkeletonLerp(
        a: number[][][],
        b: number[][][],
        t: number): number[][][] {

    const n = a.length;
    if (n === 0) { return []; }

    const cA = chords(a);
    const cB = chords(b);

    // Absolute chord angles: initial angle the short way round, turning
    // angles (already wrapped) lerped linearly.
    const phis: number[] = [cA.phi[0] + t*wrapAngle(cB.phi[0] - cA.phi[0])];
    for (let k = 1; k < n; k++) {
        const dA = wrapAngle(cA.phi[k] - cA.phi[k - 1]);
        const dB = wrapAngle(cB.phi[k] - cB.phi[k - 1]);
        phis.push(phis[k - 1] + (1 - t)*dA + t*dB);
    }

    let px = a[0][0][0]*(1 - t) + b[0][0][0]*t;
    let py = a[0][0][1]*(1 - t) + b[0][0][1]*t;

    const out: number[][][] = [];
    for (let k = 0; k < n; k++) {
        const L = cA.L[k]*(1 - t) + cB.L[k]*t;
        const bx = L*cos(phis[k]);
        const by = L*sin(phis[k]);

        const qA = chordNormalize(a[k]);
        const qB = chordNormalize(b[k]);

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


/** Per-segment chord length and angle; degenerate chord angles are filled
 *  from the nearest non-degenerate segment. */
function chords(bz: number[][][]): { L: number[]; phi: number[] } {
    const L: number[] = [];
    const phi: number[] = [];

    for (const ps of bz) {
        const p0 = ps[0];
        const p1 = ps[ps.length - 1];
        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];
        const l = hypot(dx, dy);
        L.push(l);
        phi.push(l < EPS ? NaN : atan2(dy, dx));
    }

    // Forward fill, then backward fill, then fallback.
    for (let k = 1; k < phi.length; k++) {
        if (Number.isNaN(phi[k])) { phi[k] = phi[k - 1]; }
    }
    for (let k = phi.length - 2; k >= 0; k--) {
        if (Number.isNaN(phi[k])) { phi[k] = phi[k + 1]; }
    }
    for (let k = 0; k < phi.length; k++) {
        if (Number.isNaN(phi[k])) { phi[k] = 0; }
    }

    return { L, phi };
}


/** Control points in the segment's own chord frame (chord ↦ (0,0)→(1,0)). */
function chordNormalize(ps: number[][]): number[][] {
    const e0 = ps[0];
    const e1 = ps[ps.length - 1];
    let bx = e1[0] - e0[0];
    let by = e1[1] - e0[1];
    let den = bx*bx + by*by;
    // Degenerate chord: translation only (mirrored at reconstruction).
    if (den < EPS*EPS) { bx = 1; by = 0; den = 1; }

    return ps.map(p => {
        const ux = p[0] - e0[0];
        const uy = p[1] - e0[1];
        return [(bx*ux + by*uy) / den, (-by*ux + bx*uy) / den];
    });
}


function wrapAngle(x: number): number {
    return ((x + π) % (2*π) + 2*π) % (2*π) - π;
}


/**
 * Per-segment chord angles, UNWRAPPED cumulatively (adjacent segments differ
 * by their true turning angle, never a ±2π jump) - a continuous angle
 * profile along the skeleton.
 */
function unwrappedChordAngles(bz: number[][][]): number[] {
    const { phi } = chords(bz);

    const out = [phi[0]];
    for (let k = 1; k < phi.length; k++) {
        out.push(out[k - 1] + wrapAngle(phi[k] - phi[k - 1]));
    }

    return out;
}


export { intrinsicSkeletonLerp, wrapAngle, unwrappedChordAngles }
