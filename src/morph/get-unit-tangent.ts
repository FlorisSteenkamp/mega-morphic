import { evalDeCasteljau, tangent, unitTangent } from 'flo-bezier3';


/**
 * Returns the unit tangent at param `t` (finite-difference fallback for degenerates).
 */
function getUnitTangent(ps: number[][], t: number): number[] {
    let [x, y] = tangent(ps, t);
    let h = Math.hypot(x, y);
    if (h === 0) {
        const p0 = evalDeCasteljau(ps, Math.max(0, t - 0.01));
        const p1 = evalDeCasteljau(ps, Math.min(1, t + 0.01));
        [x, y] = [p1[0] - p0[0], p1[1] - p0[1]];
        h = Math.hypot(x, y);
        if (h === 0) { return [1, 0]; }
    }
    return [x / h, y / h];
}


export { getUnitTangent }
