import type { MorphEntry } from "../morph-entry.js";
import { memoize } from 'flo-memoize';
import { getLastP } from '../fs/get-last-p.js';
import { pAtIndex } from '../fs/p-at-idx.js';
import { intrinsicSkeletonLerp } from '../intrinsic-skeleton/intrinsic-skeleton.js';
import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';

const { min, max, floor, cos, sin } = Math;


/**
 * Returns the drawn beziers at `t` for the given morph entries.
 * 
 * Skeleton interpolated intrinsically between frames `a` and `b`, then, if
 * the entry is glued, translated so its endpoint rides its parent's drawn
 * skeleton AND rotated about that junction by the parent's local frame
 * rotation there (beyond the naive angle lerp) - so the child's angle
 * RELATIVE to its parent interpolates linearly. All angles are tracked
 * UNWRAPPED and continuously in t (`alphas` carries each entry's continuous
 * anchor angle), so the rotation never jumps by 2π mid-morph. Parents are
 * resolved recursively on demand; results are cached in `drawn`.
 */
const getMorphedSkeleton = memoize(function(
        entries: MorphEntry[],
        t: number,
        i: number) {

    const parentPsi_ = parentPsi(entries, t);
    const staticPsiA_ = staticPsiA(entries);
    const staticPsiB_ = staticPsiB(entries);

    const { skelPssA, skelPssB, glue } = entries[i];

    // Length + knot-angle interpolation (not a control-point lerp).
    let pss = intrinsicSkeletonLerp(skelPssA, skelPssB, t);

    // Continuous anchor angle (matches intrinsicSkeletonLerp's φ0(t)).
    const ψsAe = unwrappedChordAngles(skelPssA);
    const ψsBe = unwrappedChordAngles(skelPssB);
    const φ0A = ψsAe[0];
    const φ0B = ψsBe[0];
    let α = φ0A + t*wrapAngle(φ0B - φ0A);

    if (glue === undefined) {
        return { alpha: α, pss };
    }


    let target: number[];
    let dψ: number;  // parent frame rotation beyond its naive lerp

    const { e1, e2, k1, k2 } = glue;

    if (e1 === e2) {
        // Junction slides along the one parent from k1 to k2.
        const kf = (1 - t)*k1 + t*k2;
        const { pss } = getMorphedSkeleton(entries, t, e1);
        target = pAtIndex(pss, kf);

        const ψ = parentPsi_(e1, kf);
        dψ = (1 - t)*(ψ - staticPsiA_(e1, k1)) +
             t*(ψ - staticPsiB_(e1, k2));
    } else {
        // Attached to different branches per frame: blend between
        // the two attachment points' drawn positions.
        const { pss: pss1 } = getMorphedSkeleton(entries, t, e1);
        const p1 = pAtIndex(pss1, k1);
        const { pss: pss2 } = getMorphedSkeleton(entries, t, e2);
        const p2 = pAtIndex(pss2, k2);
        target = [
            (1 - t)*p1[0] + t*p2[0],
            (1 - t)*p1[1] + t*p2[1]
        ];

        dψ = (1 - t)*(parentPsi_(e1, k1) -
             staticPsiA_(e1, k1)) +
             t*(parentPsi_(e2, k2) -
             staticPsiB_(e2, k2));
    }

    // Take the shortest rotation RELATIVE to the parent, not in
    // absolute terms - so children follow their parent's rotation
    // instead of swinging the other way around (2π-multiple
    // correction, scaled by t: t=0/1 geometry unaffected). A
    // collapsed frame has NO orientation (fill angles) - hold the
    // parent-relative angle constant at the REAL frame's value
    // instead (cancelling relΔ rotates only the collapsed point).
    // Anchored at the JUNCTION end: the interior bend deltas of the
    // intrinsic lerp can hide a ±2π turn there that the tip-side
    // φ0 branch alone cannot see.
    const
        junctionRot = wrapAngle(φ0B - φ0A) +
        (ψsBe[ψsBe.length - 1] - φ0B) -
        (ψsAe[ψsAe.length - 1] - φ0A);

    const relΔ = junctionRot -
        (staticPsiB_(glue.e2, glue.k2) -
         staticPsiA_(glue.e1, glue.k1));

    const { collapsed } = entries[i];
    dψ += collapsed === 'b' ? -t*relΔ
        : collapsed === 'a' ? (1 - t)*relΔ
        : t*(wrapAngle(relΔ) - relΔ);

    α += dψ;

    // Rotate about the junction by dψ, then move it onto the parent
    // (both vanish at t=0 and t=1).
    const base = getLastP(pss);
    const dx = target[0] - base[0];
    const dy = target[1] - base[1];
    const c = cos(dψ);
    const s = sin(dψ);

    pss = pss.map(ps => ps.map(p => {
        const ux = p[0] - base[0];
        const uy = p[1] - base[1];
        return [
            base[0] + dx + c*ux - s*uy,
            base[1] + dy + s*ux + c*uy
        ];
    }));

    return { alpha: α, pss };
}, [0,1] /** cache only for 1 t value */, false /** log cache hits/misses? */);


/**
 * ψ at attachment `k` on the DRAWN parent `e`, continuous in t.
 */
function parentPsi(
        entries: MorphEntry[],
        t: number) {

    return function(e: number, k: number): number {
        const { alpha, pss } = getMorphedSkeleton(entries, t, e);
        const ψs = unwrappedChordAngles(pss);

        return alpha + (profileAngleAt(ψs, k) - ψs[0]);
    }
}


/**
 * ψ at `k` on parent `e`'s static frame-a skeleton.
 */
function staticPsiA(
        entries: MorphEntry[]) {

    return function (e: number, k: number): number {
        return profileAngleAt(unwrappedChordAngles(
            entries[e].skelPssA
        ), k);
    }
}


/**
 * ψ at `k` on parent `e`'s static frame-b skeleton, re-anchored to the
 *  drawn parent's continuous anchor at t=1 (same value mod 2π).
 */
function staticPsiB(
        entries: MorphEntry[]) {

    return function (e: number, k: number): number {
        const ψsA = unwrappedChordAngles(entries[e].skelPssA);
        const ψsB = unwrappedChordAngles(entries[e].skelPssB);
        const adj = ψsA[0] + wrapAngle(ψsB[0] - ψsA[0]) - ψsB[0];

        return profileAngleAt(ψsB, k) + adj;
    }
}


/**
 * The angle profile's value at (fractional) boundary index `kf`, CONTINUOUS
 * in `kf`: unwrapped per-segment chord angles interpolated between segment
 * midpoints - so a sliding attachment never jumps across a sharp bend.
 */
function profileAngleAt(ψs: number[], kf: number): number {
    const n = ψs.length;
    if (n === 1) { return ψs[0]; }

    // Segment k's angle sits at index k + 0.5.
    const x = min(max(kf - 0.5, 0), n - 1);
    const k = min(floor(x), n - 2);
    const f = x - k;

    return ψs[k]*(1 - f) + ψs[k + 1]*f;
}


export { getMorphedSkeleton }
