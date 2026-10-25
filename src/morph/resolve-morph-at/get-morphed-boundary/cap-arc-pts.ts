
const { atan2, tan, cos, sin, abs, ceil, PI: π } = Math;


const MIN_LEN = 1e-6;

/**
 * a sweep (in the winding direction) within this of a full turn is taken
 * as near-coincident endpoints, crossed slightly backwards
 */
const NEAR_FULL_TURN = π/4;


/**
 * The arc of the disk at `p` from `from` to `to` as TRUE cubic bezier
 * segments (≤ quarter circle each - visually exact at any zoom), sweeping
 * in the direction given by the outline winding `sign`. Endpoints lie on
 * the circle of radius `r`; sub-MIN_LEN mismatches with the neighboring
 * pieces are welded by `assembleLoop`.
 *
 * * a sweep within `NEAR_FULL_TURN` of a full turn sweeps the short way
 *   back instead: the endpoints nearly coincide (as when the sides meet at
 *   the cap) and `to` has merely drifted behind `from` - a full circle
 *   there would pop in the moment t leaves 0 (where the endpoints coincide
 *   exactly and the arc is empty), and with it the measured pose
 *   (`poseCorrectionAt` would rescale the whole shape). A real cap never
 *   sweeps that far: the route's own prong always takes part of the disk.
 */
function capArcBeziers(
        p: number[],
        r: number,
        from: number[],
        to: number[],
        sign: number): number[][][] {

    if (r < MIN_LEN) { return []; }

    const a0 = atan2(from[1] - p[1], from[0] - p[0]);
    const a1 = atan2(to[1] - p[1], to[0] - p[0]);

    return arcBeziers(p, r, a0, calcCapSweep(a0, a1, sign));
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
 * Returns the sweep of the cap arc from angle `a0` to `a1` (`capArcBeziers`):
 * in the winding direction given by `sign`, unless within
 * `NEAR_FULL_TURN` of a full turn - then the short way back.
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


export { capArcBeziers, arcBeziers, calcCapSweep }
