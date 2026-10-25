import type { SleeveSide } from '../../anchored-sleeves.js';
import { controlPointLinesLength, toCubic } from 'flo-bezier3';
import { boundaryPoint } from '../../anchored-sleeves.js';
import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';
import { arcBeziers, calcCapSweep } from './cap-arc-pts.js';

const { cos, sin, hypot, atan2, min, abs, round, PI: π } = Math;


const MIN_LEN = 1e-6;


/**
 * One side's boundary pieces at time `t`, in outline order
 * 
 * * anchors interpolated in the drawn disks' local frames
 * * chord-normalized pieces lerped and mapped through the interpolated anchor chords.
 * 
 * Fork gaps (skipped child sectors) are bridged with the fork disk's arc,
 * swept with the winding - the parent's true region boundary there.
 */
function reconstructSide(
        side: SleeveSide,
        isOut: boolean,
        bz: number[][][],
        rs: number[],
        Ts: number[][],
        capSign: number,
        t: number): { pieces: number[][][]; first: number[]; last: number[] } {

    const { piecesA, piecesB, anchorsA, anchorsB } = side;
    const gapSweeps = calcGapSweeps(side, isOut, capSign);

    const len = piecesA.length;
    const pieces: number[][][] = [];
    let first = [0,0];
    let last = [0,0];

    for (let m=0; m<len; m++) {
        const k = isOut ? m : len - 1 - m;  // outline order

        const aA = anchorsA[k];
        const aB = anchorsB[k];
        const bidxFrom = isOut ? k : k + 1;
        const bidxTo = isOut ? k + 1 : k;

        const e0 = anchorPoint(
            aA[0], aA[1], aB[0], aB[1], bidxFrom, bz, rs, Ts, t);
        const e1 = anchorPoint(
            aA[2], aA[3], aB[2], aB[3], bidxTo, bz, rs, Ts, t);

        if (m === 0) {
            first = e0;
        } else {
            // Fork gap: bridge along the boundary disk at this knot.
            const { sweepA, dSweep } = gapSweeps[k];
            const sweep = sweepA + t*dSweep;
            const r = rs[bidxFrom];
            if (abs(sweep)*r > 1e-3) {
                const p = boundaryPoint(bz, bidxFrom);
                const a0 = atan2(last[1] - p[1], last[0] - p[0]);
                pieces.push(...arcBeziers(p, r, a0, sweep));
            }
        }
        last = e1;

        // Chord frame of the interpolated anchors (same degenerate rule as
        // normalization so t=0/1 reproduce the originals exactly).
        let bx = e1[0] - e0[0];
        let by = e1[1] - e0[1];
        if (bx*bx + by*by < MIN_LEN*MIN_LEN*1e-6) { bx = 1; by = 0; }

        const qsA = piecesA[k];
        const qsB = piecesB[k];
        const mapped: number[][][] = [];
        for (let i = 0; i < qsA.length; i++) {
            const ps = intrinsicPieceLerp(qsA[i], qsB[i], t).map(q => [
                e0[0] + bx*q[0] - by*q[1],
                e0[1] + by*q[0] + bx*q[1]
            ]);
            // eps-length pieces carry no geometry, only noise directions -
            // dropping them lets the assembly weld the real neighbors
            if (controlPointLinesLength(ps) >= 1e-3) { mapped.push(ps); }
        }

        // Segment-joint tangents interpolated as DATA (τ lerped short-way in
        // the drawn disk frame): originals put curvature in the turning
        // BETWEEN chords, so mid-morph it lands entirely at the joints as
        // kinks (polyline-jagged) unless the handles absorb it. In/out τ's
        // are stored per adjacent segment, so corners keep their
        // interpolated opening angle automatically.
        if (mapped.length > 0) {
            const τ0 = jointDir(aA[4], aB[4], bidxFrom, bz, Ts, t);
            const τ1 = jointDir(aA[5], aB[5], bidxTo, bz, Ts, t);
            if (τ0 !== undefined) {
                mapped[0] = setStartTangent(mapped[0], τ0);
            }
            if (τ1 !== undefined) {
                mapped[mapped.length - 1] =
                    setEndTangent(mapped[mapped.length - 1], τ1);
            }
        }
        pieces.push(...mapped);
    }

    return { pieces, first, last };
}


/**
 * Returns the sweep of each fork gap's arc (at the start of piece `k`, in
 * outline order) as `sweepA + t·dSweep`: following its two anchors
 * continuously (`dSweep`: the difference of their short-way turns), so it
 * never flips mid-morph.
 *
 * * where the anchors' turns don't take the gap from its sweep in A to its
 *   sweep in B (`calcCapSweep`) - they differ by whole turns - the arc
 *   carries the extra full turns at one end, in the winding direction: a
 *   full turn that way round the gap's disk leaves the filled shape as it
 *   is
 *
 * @param side the sleeve side
 * @param isOut whether it is the out side (pieces in outline order) or the
 * back side (pieces in reverse)
 * @param capSign the outline winding
 */
function calcGapSweeps(
        side: SleeveSide,
        isOut: boolean,
        capSign: number): { sweepA: number; dSweep: number }[] {

    const { anchorsA, anchorsB } = side;
    const len = anchorsA.length;

    const gapSweeps = anchorsA.map(() => ({ sweepA: 0, dSweep: 0 }));
    for (let m = 1; m < len; m++) {
        const k = isOut ? m : len - 1 - m;
        const kPrev = isOut ? k - 1 : k + 1;

        const sweepA = calcCapSweep(anchorsA[kPrev][2], anchorsA[k][0], capSign);
        const sweepB = calcCapSweep(anchorsB[kPrev][2], anchorsB[k][0], capSign);
        const dSweep =
            wrapAngle(anchorsB[k][0] - anchorsA[k][0]) -
            wrapAngle(anchorsB[kPrev][2] - anchorsA[kPrev][2]);

        // extra forward turns at B (> 0) or, as many, at A (< 0)
        const turns = round((sweepA + dSweep - sweepB) / (capSign*2*π));

        gapSweeps[k] = {
            sweepA: sweepA + (turns < 0 ? -turns*capSign*2*π : 0),
            dSweep
        };
    }

    return gapSweeps;
}


/** The interpolated joint tangent direction in the DRAWN frame at skeleton
 *  boundary `bidx` (`undefined` when either side's τ is degenerate). */
function jointDir(
        τA: number,
        τB: number,
        bidx: number,
        bz: number[][][],
        Ts: number[][],
        t: number): number[] | undefined {

    if (Number.isNaN(τA) || Number.isNaN(τB)) { return undefined; }

    const τ = τA + t*wrapAngle(τB - τA);

    return fromTN(τ, Ts[bidx]);
}


/**
 * The unit vector at angle `θ` in the (T, N) basis (N = T rotated +90°) -
 * the inverse of `anchored-sleeves`' `tangentAngle`.
 */
function fromTN(θ: number, T: number[]): number[] {
    const N = [-T[1], T[0]];

    return [
        cos(θ)*T[0] + sin(θ)*N[0],
        cos(θ)*T[1] + sin(θ)*N[1]
    ];
}


/** The piece with its START handle rotated onto `dir` (travel direction);
 *  lines/quads are promoted to cubics so the tangent is theirs alone. */
function setStartTangent(ps: number[][], dir: number[]): number[][] {
    const [p0, p1, p2, p3] = toCubic(ps);
    const chord = hypot(p3[0] - p0[0], p3[1] - p0[1]);
    let l = hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (l < 1e-9) { l = chord/3; }
    if (l < 1e-9) { return [p0, p1, p2, p3]; }
    return [p0, [p0[0] + l*dir[0], p0[1] + l*dir[1]], p2, p3];
}


/**
 * The piece with its END handle rotated onto `dir` (travel direction):
 * `setStartTangent` on the piece walked backwards (promoted to a cubic
 * BEFORE reversing, so lines/quads get the same handles as forwards).
 */
function setEndTangent(ps: number[][], dir: number[]): number[][] {
    const backwards = toCubic(ps).toReversed();

    return setStartTangent(backwards, [-dir[0], -dir[1]]).toReversed();
}


/**
 * Interpolates one chord-normalized boundary piece INTRINSICALLY: endpoint
 * positions lerped, but interior control points (handles) rebuilt from
 * separately interpolated handle ANGLE (short way) and LENGTH (geometric).
 * A Cartesian control-point lerp rotates a handle's direction at a rate
 * proportional to the A:B handle length ratio, so adjacent pieces with
 * different stretch ratios disagree on the tangent mid-morph (G1 kinks at
 * every anchor, worst near an endpoint) - angle-linear interpolation makes
 * both sides of a smooth joint rotate in lockstep, preserving G1 at ALL t.
 * Degenerate handles fall back to the Cartesian lerp.
 */
function intrinsicPieceLerp(
        a: number[][],
        b: number[][],
        t: number): number[][] {

    const n = a.length;
    const lerpPt = (u: number[], v: number[]): number[] =>
        [u[0]*(1 - t) + v[0]*t, u[1]*(1 - t) + v[1]*t];

    const q0 = lerpPt(a[0], b[0]);
    if (n <= 2 || b.length !== n) {
        // lines (no handles) / mismatched structure: plain lerp
        return a.map((q, j) => lerpPt(q, b[min(j, b.length - 1)]));
    }
    const qN = lerpPt(a[n - 1], b[n - 1]);

    if (n === 4) {
        const q1 = polarHandle(q0, a[0], a[1], b[0], b[1], t)
            ?? lerpPt(a[1], b[1]);
        const q2 = polarHandle(qN, a[3], a[2], b[3], b[2], t)
            ?? lerpPt(a[2], b[2]);
        return [q0, q1, q2, qN];
    }

    // quad: the single control point serves both end tangents - average
    // the two polar reconstructions
    const c0 = polarHandle(q0, a[0], a[1], b[0], b[1], t);
    const c1 = polarHandle(qN, a[2], a[1], b[2], b[1], t);
    const q1 = c0 !== undefined && c1 !== undefined
        ? [(c0[0] + c1[0])/2, (c0[1] + c1[1])/2]
        : lerpPt(a[1], b[1]);
    return [q0, q1, qN];
}


/**
 * The interpolated handle tip: angle lerped the short way, length
 * geometric, applied at the interpolated endpoint `base`. `undefined` when
 * either handle is degenerate (no direction to interpolate).
 */
function polarHandle(
        base: number[],
        aEnd: number[], aCtrl: number[],
        bEnd: number[], bCtrl: number[],
        t: number): number[] | undefined {

    const hAx = aCtrl[0] - aEnd[0];
    const hAy = aCtrl[1] - aEnd[1];
    const hBx = bCtrl[0] - bEnd[0];
    const hBy = bCtrl[1] - bEnd[1];

    const lA = hypot(hAx, hAy);
    const lB = hypot(hBx, hBy);
    if (lA < 1e-9 || lB < 1e-9) { return undefined; }

    const θA = atan2(hAy, hAx);
    const dθ = wrapAngle(atan2(hBy, hBx) - θA);
    const θ = θA + t*dθ;
    const l = lA**(1 - t) * lB**t;

    return [base[0] + l*cos(θ), base[1] + l*sin(θ)];
}


/**
 * Returns the interpolated anchor
 *
 * * polar coords lerped (θ the short way) and applied to the DRAWN disk's
 *   local frame at skeleton boundary `bidx`.
 */
function anchorPoint(
        thA: number, rhA: number,
        thB: number, rhB: number,
        bidx: number,
        bz: number[][][],
        rs: number[],
        Ts: number[][],
        t: number): number[] {

    const dθ = wrapAngle(thB - thA);
    const θ = thA + t*dθ;
    const ρ = rhA*(1 - t) + rhB*t;

    const p = boundaryPoint(bz, bidx);
    const r = rs[bidx];
    const [ux, uy] = fromTN(θ, Ts[bidx]);

    return [p[0] + ρ*r*ux, p[1] + ρ*r*uy];
}


export { reconstructSide }
