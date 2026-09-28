
const { atan2, max, tan, cos, sin, abs, ceil, PI: π } = Math;


const MIN_LEN = 1e-6;


/**
 * The arc of the disk at `p` from `from` to `to` as TRUE cubic bezier
 * segments (≤ quarter circle each - visually exact at any zoom), sweeping
 * in the direction given by the outline winding `sign`. Endpoints lie on
 * the circle of radius `r`; sub-MIN_LEN mismatches with the neighboring
 * pieces are welded by `assembleLoop`.
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

    const ccw = ((a1 - a0) % (2*π) + 2*π) % (2*π);
    const sweep = sign > 0 ? ccw : ccw - 2*π;
    if (abs(sweep) < 1e-9) { return []; }

    const segs = max(1, ceil(abs(sweep) / (π/2)));
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


export { capArcBeziers }
