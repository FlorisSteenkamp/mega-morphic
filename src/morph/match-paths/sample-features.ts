import type { Samples } from './samples.js';
import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { clamp } from '../../utils/clamp.js';
import { length$ } from '../fs/length.js';
import { sum } from '../../utils/sum.js';
import { memoize } from 'flo-memoize';

const { max, min } = Math;


/**
 * Resamples a path's geometry into fixed-rate feature profiles for DTW
 * alignment: radius and turning rate at `n` positions spread uniformly over
 * normalized arc length, start (u=0) → end (u=1).
 *
 * The inputs live on the skeleton's knots (one value per bezier endpoint,
 * generally non-uniformly spaced); they are interpolated piecewise-linearly
 * over the knots' normalized arc-length positions so that two paths of
 * different lengths and segmentations become directly comparable, sample
 * for sample.
 *
 * The turning profile is the derivative (central difference) of the
 * unwrapped chord angles, i.e. curvature against normalized arc length -
 * unwrapping keeps it continuous across the ±π seam.
 *
 * @param pss the path's skeleton as bezier curves (in travel order)
 * @param radii MAT disk radius at each skeleton knot (`pss.length + 1` values)
 * @param unit length normalization (e.g. a glyph-scale unit) so radii are
 * scale-free and comparable across shapes
 * @param maxN sample-count cap; the count is `2 * pss.length` clamped to
 * `[min(24, maxN), maxN]` - enough to resolve every segment, bounded for
 * cost (use a small `maxN` for coarse beam ranking)
 */
const sampleFeatures$ = memoize(function(
        maxN: number,
        unit: number) {

    return memoize(function(
            pss: number[][][],
            radii: number[]): Samples {

        const n = clamp(2 * pss.length, min(24, maxN), maxN);

        const lens = pss.map(length$);
        const totalLen = sum(lens);
        const knots = [0];
        let cum = 0;
        for (const l of lens) {
            cum += l;
            knots.push(totalLen > 0 ? cum / totalLen : 0);
        }
        knots[knots.length - 1] = 1;

        const φs = padProfile(unwrappedChordAngles(pss), radii.length);

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
            turn.push((φ[i1] - φ[i0]) / (u[i1] - u[i0]));
        }

        return { u, r, turn };
    });
});


/** Chord angles live per segment (rd is per boundary): pad to align. */
function padProfile(φs: number[], m: number): number[] {
    const out = φs.slice();
    while (out.length < m) {
        out.push(out[out.length - 1] ?? 0);
    }

    return out;
}


/** Piecewise-linear value over `knots` at normalized position `u`. */
function valueAt(vals: number[], knots: number[], u: number): number {
    let j = 0;
    while (j < knots.length - 2 && knots[j + 1] <= u) {
        j++;
    }

    const span = knots[j + 1] - knots[j];
    const f = span <= 0 ? 0 : clamp((u - knots[j]) / span, 0, 1);

    return vals[j]*(1 - f) + vals[min(j + 1, vals.length - 1)]*f;
}


export { sampleFeatures$ }