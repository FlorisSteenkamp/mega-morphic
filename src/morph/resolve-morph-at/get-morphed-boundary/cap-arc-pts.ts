import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';

const { atan2, tan, cos, sin, abs, ceil, round, PI: π } = Math;


const MIN_LEN = 1e-6;

/**
 * a sweep (in the winding direction) within this of a full turn is taken
 * as near-coincident endpoints, crossed slightly backwards
 */
const NEAR_FULL_TURN = π/4;


/**
 * The sweep of an arc between two disk-anchored points as `sweepA +
 * t·dSweep` (`calcSweepRamp`).
 */
interface SweepRamp {
    readonly sweepA: number;
    readonly dSweep: number;
}


/**
 * The arc of the disk at `p` of radius `r` from `from` sweeping by `sweep`
 * as TRUE cubic bezier segments (≤ quarter circle each - visually exact at
 * any zoom). Endpoints lie on the circle; sub-MIN_LEN mismatches with the
 * neighboring pieces are welded by `assembleLoop`.
 */
function capArcBeziers(
        p: number[],
        r: number,
        from: number[],
        sweep: number): number[][][] {

    const a0 = atan2(from[1] - p[1], from[0] - p[0]);

    return arcBeziers(p, r, a0, sweep);
}


/**
 * The arc of the disk at `p` of radius `r` from angle `a0` sweeping by
 * `sweep` (any size, full turns included) as true cubic bezier segments (≤
 * quarter circle each).
 */
function arcBeziers(
        p: number[],
        r: number,
        a0: number,
        sweep: number): number[][][] {

    if (r < MIN_LEN || abs(sweep) < 1e-9) { return []; }

    // ≥ 1 since |sweep| ≥ 1e-9
    const segs = ceil(abs(sweep) / (π/2));
    const out: number[][][] = [];
    for (let i = 0; i < segs; i++) {
        const th0 = a0 + sweep * (i / segs);
        const th1 = a0 + sweep * ((i + 1) / segs);
        // standard circular-arc cubic: signed control distance
        const k = (4/3) * tan((th1 - th0) / 4) * r;
        const p0 = [p[0] + r*cos(th0), p[1] + r*sin(th0)];
        const p3 = [p[0] + r*cos(th1), p[1] + r*sin(th1)];
        out.push([
            p0,
            [p0[0] - k*sin(th0), p0[1] + k*cos(th0)],
            [p3[0] + k*sin(th1), p3[1] - k*cos(th1)],
            p3
        ]);
    }
    return out;
}


/**
 * Returns the sweep of the arc from angle `a0` to `a1`: in the winding
 * direction given by `sign`, unless within `NEAR_FULL_TURN` of a full turn -
 * then the short way back.
 *
 * * the short way back: the endpoints nearly coincide (as when the sides
 *   meet at the cap) and `a1` has merely drifted behind `a0` - a full
 *   circle there would pop in the moment t leaves 0 (where the endpoints
 *   coincide exactly and the arc is empty), and with it the measured pose
 *   (`poseCorrectionAt` would rescale the whole shape). A real cap never
 *   sweeps that far: the route's own prong always takes part of the disk.
 *
 * * only decides the sweeps at t=0/1 - mid-morph this rule would flip
 *   the arc the moment it crosses the threshold (`calcSweepRamp`)
 */
function calcCapSweep(
        a0: number,
        a1: number,
        sign: number): number {

    const ccw = ((a1 - a0) % (2*π) + 2*π) % (2*π);
    const forward = sign > 0 ? ccw : ccw - 2*π;

    return abs(forward) > 2*π - NEAR_FULL_TURN
        ? forward - sign*2*π
        : forward;
}


/**
 * Returns the sweep of the arc from the anchor at angle `fromA` to the one
 * at `toA` in A (t=0), going to `fromB` → `toB` in B (t=1), as `sweepA +
 * t·dSweep`: following its two anchors continuously (`dSweep`: the
 * difference of their short-way turns - the very turns the anchors are
 * interpolated along), so it never flips mid-morph.
 *
 * * angles in the anchors' disk frames (both anchors on the same disk)
 *
 * * where the anchors' turns don't take the arc from its sweep in A to its
 *   sweep in B (`calcCapSweep`) - they differ by whole turns - the arc
 *   carries the extra full turns at one end, in the winding direction: a
 *   full turn that way round the disk leaves the filled shape as it is
 *
 * @param fromA
 * @param toA
 * @param fromB
 * @param toB
 * @param sign the outline winding
 */
function calcSweepRamp(
        fromA: number,
        toA: number,
        fromB: number,
        toB: number,
        sign: number): SweepRamp {

    const sweepA = calcCapSweep(fromA, toA, sign);
    const sweepB = calcCapSweep(fromB, toB, sign);
    const dSweep = wrapAngle(toB - toA) - wrapAngle(fromB - fromA);

    // extra forward turns at B (> 0) or, as many, at A (< 0)
    const turns = round((sweepA + dSweep - sweepB) / (sign*2*π));

    return {
        sweepA: sweepA + (turns < 0 ? -turns*sign*2*π : 0),
        dSweep
    };
}


export { capArcBeziers, arcBeziers, calcCapSweep, calcSweepRamp }
export type { SweepRamp }
