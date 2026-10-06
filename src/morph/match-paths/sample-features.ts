import type { Samples } from './samples.js';
import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { clamp } from '../../utils/clamp.js';
import { skeletonKnots } from '../fs/skeleton-knots.js';
import { valueAt } from '../fs/value-at.js';
import { padTo } from '../fs/pad-to.js';

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
 * The sample count is `2 * pss.length` clamped to `[24, 160]` - enough to
 * resolve every segment, bounded for cost.
 *
 * @param pss the path's skeleton as bezier curves (in travel order)
 * @param radii MAT disk radius at each skeleton knot (`pss.length + 1` values)
 * @param unit length normalization (e.g. a glyph-scale unit) so radii are
 * scale-free and comparable across shapes
 */
function sampleFeatures(
        pss: number[][][],
        radii: number[],
        unit: number): Samples {

    const n = clamp(2 * pss.length, 24, 160);

    const knots = skeletonKnots(pss);
    const φs = padTo(unwrappedChordAngles(pss), radii.length);

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
}


export { sampleFeatures }