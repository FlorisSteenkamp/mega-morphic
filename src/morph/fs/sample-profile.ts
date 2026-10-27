import { unwrappedChordAngles$ } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { calcSkelCumKnots } from './skeleton-knots.js';
import { valueAt } from './value-at.js';
import { padTo } from './pad-to.js';

const { max, min } = Math;


/**
 * A skeleton's knot features sampled at `n` positions spread uniformly over
 * normalized arc length `u` (start u=0 → end u=1), interpolated
 * piecewise-linearly over the knots' arc-length positions:
 *
 * * `r`: the MAT disk radius, divided by `unit`
 * * `φ`: the unwrapped chord angle
 * * `turn`: dφ/ds by central difference, with s = u·`arcLen` (0 where the
 *   span is degenerate)
 *
 * @param pss the skeleton as bezier curves (in travel order)
 * @param radii MAT disk radius at each skeleton knot (`pss.length + 1` values)
 * @param unit radius normalization
 * @param n the sample count (≥ 2)
 * @param arcLen the arc length `u` is normalized by (1 for turning against
 * `u` itself)
 */
function sampleProfile(
        pss: number[][][],
        radii: number[],
        unit: number,
        n: number,
        arcLen: number) {

    const knots = calcSkelCumKnots(pss);
    const φs = padTo(unwrappedChordAngles$(pss), radii.length);

    const u: number[] = [];
    const r: number[] = [];
    const φ: number[] = [];
    for (let i = 0; i < n; i++) {
        const ui = i / (n - 1);
        u.push(ui);
        r.push(valueAt(radii, knots, ui) / unit);
        φ.push(valueAt(φs, knots, ui));
    }

    const turn: number[] = [];
    for (let i = 0; i < n; i++) {
        const i0 = max(0, i - 1);
        const i1 = min(n - 1, i + 1);
        const ds = (u[i1] - u[i0]) * arcLen;
        turn.push(ds > 0 ? (φ[i1] - φ[i0]) / ds : 0);
    }

    return { u, r, φ, turn };
}


export { sampleProfile }
