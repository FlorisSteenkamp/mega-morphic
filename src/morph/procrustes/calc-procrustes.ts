import type { Pose } from './pose.js';
import { get2ndMomentOfInertia, getProdMomentOfInertia } from 'flo-boolean';
import { mapmap } from '../../utils/map-map.js';
import { memoize } from 'flo-memoize';
import { calcPlacement } from './calc-placement.js';

const { abs, atan2, hypot } = Math;


/**
 * Returns the coarse, moment-based pose of a single Jordan-loop shape, used
 * to normalize two shapes to a common frame before morphing.
 *
 * The axis angle is arg(c₂₀)/2 with c₂₀ = (Iyy−Ixx) + 2i·Ixy — the same
 * line as the principal eigenvector, but as the SHAPE deforms continuously
 * the axis (a direction mod π) varies continuously too: an eigen
 * decomposition labels the axes major/minor by eigenvalue order, and near
 * isotropy (c₂₀ ≈ 0) the order swaps - the "major" axis jumps 90°. The
 * phase involves no such labeling; it just rotates fast near c₂₀ = 0
 * (where `anisotropy` → 0 flags the axis as meaningless anyway).
 */
const calcProcrustes$ = memoize(function(
        bezierLoop: (number[][])[]): Pose {

    // (measured as the live pose correction measures it)
    const { centroid, scale } = calcPlacement(bezierLoop);

    // Moments are only meaningful about the centroid.
    const centered = mapmap(
        bezierLoop,
        p => [p[0] - centroid[0], p[1] - centroid[1]]
    );

    const [Ixx, Iyy] = get2ndMomentOfInertia(centered);
    const Ixy = getProdMomentOfInertia(centered);

    const angle = atan2(2*Ixy, Iyy - Ixx)/2;
    const T = abs(Ixx + Iyy);
    const c = hypot(Iyy - Ixx, 2*Ixy);
    const anisotropy = c / T;

    return {
        centroid, scale, angle, anisotropy,
        momMajor: (T + c)/2,
        momMinor: (T - c)/2
    };
});


export { calcProcrustes$ }
