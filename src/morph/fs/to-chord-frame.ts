const EPS = 1e-9;


/**
 * Returns the points expressed in the chord frame of `e0` → `e1` (the chord
 * maps to (0,0) → (1,0))
 *
 * * a degenerate chord is translation only (mirrored at reconstruction)
 */
function toChordFrame(
        ps: number[][],
        e0: number[],
        e1: number[]): number[][] {

    let bx = e1[0] - e0[0];
    let by = e1[1] - e0[1];
    let den = bx*bx + by*by;
    if (den < EPS*EPS) { bx = 1; by = 0; den = 1; }

    return ps.map(p => {
        const ux = p[0] - e0[0];
        const uy = p[1] - e0[1];
        return [(bx*ux + by*uy) / den, (-by*ux + bx*uy) / den];
    });
}


export { toChordFrame }
