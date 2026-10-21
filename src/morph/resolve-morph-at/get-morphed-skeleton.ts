import type { MorphEntry } from "../morph-entry.js";
import { memoize } from 'flo-memoize';
import { rotateAbout, translate } from 'flo-bezier3';
import { getLastP } from '../fs/get-last-p.js';
import { pAtIndex } from '../fs/p-at-idx.js';
import { intrinsicSkeletonLerp } from '../intrinsic-skeleton/intrinsic-skeleton.js';
import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';

const { min, max, floor, hypot, round, PI: π } = Math;


/**
 * Returns the drawn beziers at `t` for the given morph entries.
 * 
 * Skeleton interpolated intrinsically between frames `a` and `b`, then, if
 * the entry is glued, translated so its endpoint rides its parent's drawn
 * skeleton AND rotated about that junction by the parent's local frame
 * rotation there (beyond the naive angle lerp) - so the child's angle
 * RELATIVE to its parent interpolates linearly. All angles are tracked
 * UNWRAPPED and continuously in t (the returned `alpha` is the entry's
 * continuous anchor angle), so the rotation never jumps by 2π mid-morph.
 * Parents are resolved recursively on demand; results are memoized per
 * (entries, t, entry index).
 */
const getMorphedSkeleton$ = memoize(function(
        entries: MorphEntry[],
        t: number,
        i: number) {

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
        // No-net-rotation gauge (free-floating = trunk; children ride it
        // via glue): the intrinsic lerp anchors orientation at the route's
        // START tangent, so when the two turning profiles differ by ~±2π
        // of integrated bend (unequal U-turn folds, M→N) all downstream
        // material orbits a full turn just to land where it started.
        // Counter-rotate the WHOLE-TURN part of the material's
        // length-weighted mean orientation sweep, linearly in t, about the
        // skeleton's own mean point - 2π-multiples are exact at t=0/1, the
        // dominant material stays put and the folds unroll locally. The
        // fractional part is genuine rotation and is kept. Skipped at
        // EXACTLY t=0/1: ρ there is a whole turn = identity only up to
        // float dust, which breaks the bit-exact seam coincidence the
        // boolean union needs (the skip is the continuous limit).
        const m = t === 0 || t === 1
            ? 0
            : netTurns(ψsAe, ψsBe, skelPssA, skelPssB);
        if (m !== 0) {
            const ρ = -t*2*π*m;
            const c = meanPoint(pss);
            pss = pss.map(ps => rotateAbout(ps, ρ, c));
            α += ρ;
        }

        // A component without a partner rides its tether point's drawn
        // motion (zero in its own frame's t).
        const { tether } = entries[i];
        if (tether !== undefined) {
            const { e, k, side } = tether;
            const { skelPssA: pssA, skelPssB: pssB } = entries[e];
            const own = pAtIndex(side === 'a' ? pssA : pssB, k);
            const now = pAtIndex(getMorphedSkeleton$(entries, t, e).pss, k);

            pss = pss.map(ps => translate(ps, [now[0] - own[0], now[1] - own[1]]));
        }

        return { alpha: α, pss };
    }


    const { e, k1, k2 } = glue;

    // Junction slides along the parent from k1 to k2.
    const kf = (1 - t)*k1 + t*k2;
    const target = pAtIndex(getMorphedSkeleton$(entries, t, e).pss, kf);

    // parent frame rotation beyond its naive lerp
    const ψ = parentPsi(entries, t, e, kf);
    const ψA = staticPsiA(entries, e, k1);
    const ψB = staticPsiB(entries, e, k2);
    let dψ = (1 - t)*(ψ - ψA) + t*(ψ - ψB);

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

    const relΔ = junctionRot - (ψB - ψA);

    const { collapsed } = entries[i];
    dψ += collapsed === 'b' ? -t*relΔ
        : collapsed === 'a' ? (1 - t)*relΔ
        : t*(wrapAngle(relΔ) - relΔ);

    α += dψ;

    // Rotate about the junction by dψ, then move it onto the parent
    // (both vanish at t=0 and t=1).
    const base = getLastP(pss);
    const d = [target[0] - base[0], target[1] - base[1]];

    pss = pss.map(ps => translate(rotateAbout(ps, dψ, base), d));

    return { alpha: α, pss };
}, [0,1] /** cache only for 1 t value */, false /** log cache hits/misses? */);


/**
 * ψ at attachment `k` on the DRAWN parent `e`, continuous in t.
 */
function parentPsi(
        entries: MorphEntry[],
        t: number,
        e: number,
        k: number): number {

    const { alpha, pss } = getMorphedSkeleton$(entries, t, e);
    const ψs = unwrappedChordAngles(pss);

    return alpha + (profileAngleAt(ψs, k) - ψs[0]);
}


/**
 * ψ at `k` on parent `e`'s static frame-a skeleton.
 */
function staticPsiA(
        entries: MorphEntry[],
        e: number,
        k: number): number {

    return profileAngleAt(unwrappedChordAngles(entries[e].skelPssA), k);
}


/**
 * ψ at `k` on parent `e`'s static frame-b skeleton, re-anchored to the
 *  drawn parent's continuous anchor at t=1 (same value mod 2π).
 */
function staticPsiB(
        entries: MorphEntry[],
        e: number,
        k: number): number {

    const ψsA = unwrappedChordAngles(entries[e].skelPssA);
    const ψsB = unwrappedChordAngles(entries[e].skelPssB);
    const adj = ψsA[0] + wrapAngle(ψsB[0] - ψsA[0]) - ψsB[0];

    return profileAngleAt(ψsB, k) + adj;
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


/**
 * Whole turns of the lerp's length-weighted mean orientation sweep: per
 * knot the sweep is Δk = φ0-short-way + the profiles' cumulative turning
 * difference; weights are the mean chord lengths (t-independent).
 */
function netTurns(
        ψsA: number[],
        ψsB: number[],
        a: number[][][],
        b: number[][][]): number {

    const d0 = wrapAngle(ψsB[0] - ψsA[0]);

    let sumΔ = 0;
    let sumL = 0;
    for (let k = 0; k < ψsA.length; k++) {
        const L = (chordLen(a[k]) + chordLen(b[k])) / 2;
        sumΔ += L*(d0 + (ψsB[k] - ψsB[0]) - (ψsA[k] - ψsA[0]));
        sumL += L;
    }

    return sumL > 0 ? round(sumΔ / sumL / (2*π)) : 0;
}


function chordLen(ps: number[][]): number {
    const p0 = ps[0];
    const p1 = ps[ps.length - 1];
    return hypot(p1[0] - p0[0], p1[1] - p0[1]);
}


/** Chord-length-weighted mean of the beziers' chord midpoints. */
function meanPoint(pss: number[][][]): number[] {
    let x = 0, y = 0, sumL = 0;
    for (const ps of pss) {
        const p0 = ps[0];
        const p1 = ps[ps.length - 1];
        const L = chordLen(ps);
        x += L*(p0[0] + p1[0])/2;
        y += L*(p0[1] + p1[1])/2;
        sumL += L;
    }
    return sumL > 0
        ? [x/sumL, y/sumL]
        : [pss[0][0][0], pss[0][0][1]];
}


/**
 * The trunk gauge's whole-turn count for an entry (display/diagnostics -
 * the same value the drawn gauge uses).
 */
function entryNetTurns(e: MorphEntry): number {
    return netTurns(
        unwrappedChordAngles(e.skelPssA),
        unwrappedChordAngles(e.skelPssB),
        e.skelPssA, e.skelPssB
    );
}


export { getMorphedSkeleton$, entryNetTurns }
