import type { MorphEntry } from '../../morph-entry.js';
import { getLastP } from '../../fs/get-last-p.js';
import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';
import { boundaryTangents } from '../../anchored-sleeves.js';
import { capArcBeziers } from './cap-arc-pts.js';
import { assembleLoop } from './assemble-loop.js';
import { toCubic } from 'flo-bezier3';
import { reconstructSide } from './reconstruct-side.js';

const { atan2, hypot, cos, sin, abs, min, PI: π } = Math;

/** joints kinked more than this are treated as corners (left alone) */
const SMOOTH_MAX_KINK = 25 * π/180;


/**
 * The morphed outline of one entry (i.e. a branch)
 * 
 * * per skeleton segment
 * * both frames' boundary anchors rebuilt in the DRAWN disks' local
 *   frames (so they ride the interpolated maximal disks) and interpolated;
 *   the boundary pieces between them lerped in their chord frames and mapped
 *   through the interpolated chords;
 * * the two sides closed with disk cap arcs at the tips (fork/tip gaps bridged
 *   with line segments - the loop union covers those)
 * 
 * @param entry
 * @param skelPss
 * @param radii lerped radii
 * @param t
 */
function getMorphedBoundary(
        entry: MorphEntry,
        skelPss: number[][][],
        radii: number[],
        t: number): number[][][] | undefined {

    const { sleeveOut, sleeveBack, capSign } = entry;

    if (sleeveOut.piecesA.length === 0) { return undefined; }

    const Ts = boundaryTangents(skelPss);

    const out = reconstructSide(sleeveOut, true, skelPss, radii, Ts, capSign, t);
    const back = reconstructSide(sleeveBack, false, skelPss, radii, Ts, capSign, t);

    const pStart = skelPss[0][0];
    const pEnd = getLastP(skelPss);

    // out runs tip → end, back runs end → tip (outline direction).
    // A glued entry closes through its JUNCTION (= pEnd, glued onto the
    // parent's skeleton, strictly interior to the parent's region) - the
    // wedge guarantees overlap with the parent at every t, and at t=0/1 its
    // extra sliver is covered by the parent's fork-gap arc.
    const endCap = entry.glue !== undefined
        ? [[pEnd]]  // waypoint: close through the junction
        : capArcBeziers(
            pEnd, radii[radii.length - 1], out.last, back.first, capSign);

    const startCap = capArcBeziers(
        pStart, radii[0], back.last, out.first, capSign
    );

    const loop = assembleLoop([
        ...out.pieces,
        ...endCap,
        ...back.pieces,
        ...startCap,
    ]);

    // Mid-morph the interpolation deposits curvature at joints as small
    // kinks (quantization/lerp artifacts) - redistribute them into the
    // handles, DAMPED to zero at t=0/1 so the endpoints stay exact.
    // Real corners (> SMOOTH_MAX_KINK) are left alone.
    if (loop !== undefined) {
        const strength = min(1, 4*t*(1 - t));
        if (strength > 0) { smoothLoopG1(loop, strength); }
    }

    return loop;
}


/**
 * In-place G1 relaxation of the loop's joints: at every joint kinked less
 * than `SMOOTH_MAX_KINK`, both adjacent handles rotate toward the joint
 * bisector by the given strength (0..1). Pieces are promoted to cubics as
 * needed so every joint owns rotatable handles.
 */
function smoothLoopG1(loop: number[][][], strength: number): void {
    const n = loop.length;

    // tangent kinks are only meaningful between substantial pieces
    const dirs = loop.map(ps => {
        const d = [
            ps[ps.length - 1][0] - ps[0][0],
            ps[ps.length - 1][1] - ps[0][1]
        ];
        return hypot(d[0], d[1]);
    });

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (dirs[i] < 1e-6 || dirs[j] < 1e-6) { continue; }

        let prev = toCubic(loop[i]);
        let next = toCubic(loop[j]);

        const hIn = [prev[3][0] - prev[2][0], prev[3][1] - prev[2][1]];
        const hOut = [next[1][0] - next[0][0], next[1][1] - next[0][1]];
        const lIn = hypot(hIn[0], hIn[1]);
        const lOut = hypot(hOut[0], hOut[1]);
        if (lIn < 1e-9 || lOut < 1e-9) { continue; }

        const θIn = atan2(hIn[1], hIn[0]);
        const θOut = atan2(hOut[1], hOut[0]);
        const kink = wrapAngle(θOut - θIn);
        if (abs(kink) > SMOOTH_MAX_KINK) { continue; }  // a real corner

        // rotate both handles toward the joint bisector
        const dθ = strength * kink / 2;
        const θIn2 = θIn + dθ;
        const θOut2 = θOut - dθ;

        prev[2] = [
            prev[3][0] - lIn*cos(θIn2),
            prev[3][1] - lIn*sin(θIn2)
        ];
        next[1] = [
            next[0][0] + lOut*cos(θOut2),
            next[0][1] + lOut*sin(θOut2)
        ];
        loop[i] = prev;
        loop[j] = next;
    }
}


export { getMorphedBoundary }
