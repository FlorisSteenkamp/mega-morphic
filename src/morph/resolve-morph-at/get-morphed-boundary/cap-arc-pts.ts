
const { atan2, max, cos, sin, abs, ceil, hypot, PI: π } = Math;


const MIN_LEN = 1e-6;


/**
 * Interior points of the arc of the disk at `p` from `from` to `to`,
 * sweeping in the direction given by the outline winding `sign`.
 */
function capArcPts(
        p: number[],
        r: number,
        from: number[],
        to: number[],
        sign: number,
        capSteps = 16): number[][] {

    if (r < MIN_LEN) { return []; }

    const a0 = atan2(from[1] - p[1], from[0] - p[0]);
    const a1 = atan2(to[1] - p[1], to[0] - p[0]);

    const ccw = ((a1 - a0) % (2*π) + 2*π) % (2*π);
    const sweep = sign > 0 ? ccw : ccw - 2*π;

    const steps = max(2, ceil(capSteps * abs(sweep) / (2*π)));
    const out: number[][] = [];
    for (let k = 1; k < steps; k++) {
        const th = a0 + sweep * (k / steps);
        out.push([p[0] + r*cos(th), p[1] + r*sin(th)]);
    }
    return out;
}


export { capArcPts }
