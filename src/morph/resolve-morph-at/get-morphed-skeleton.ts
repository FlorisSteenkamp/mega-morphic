import type { MorphEntry } from "../morph-entry.js";
import { memoize } from 'flo-memoize';
import { rotateAbout, translate } from 'flo-bezier3';
import { getLastP } from '../fs/get-last-p.js';
import { pAtIndex } from '../fs/p-at-idx.js';
import { intrinsicSkeletonLerp } from '../intrinsic-skeleton/intrinsic-skeleton.js';
import { calcAngleProgress } from '../intrinsic-skeleton/calc-angle-progress.js';
import { unwrappedChordAngles$ } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';

const { min, max, floor, hypot, round, atan2, PI: π } = Math;

/** a parent stretch spreading less than this (× its reach, RMS) has no
 *  reliable direction (`calcWindowFit`) - a straight one spreads ~0.58 */
const MIN_EXTENT = 0.05;
/** ... and from this spread on, a fully reliable one */
const MAX_EXTENT = 0.1;

/** a glued child's frame reaches at most this many junction radii along
 *  its parent (`calcReach`) */
const REACH_RADII = 3;


/**
 * Returns the drawn beziers at `t` for the given morph entries.
 *
 * Skeleton interpolated intrinsically between frames `a` and `b`, then, if
 * the entry is glued, translated so its endpoint rides its parent's drawn
 * skeleton AND rotated about that junction by the parent's local frame
 * rotation there (beyond the naive angle lerp) - so the child's angle
 * RELATIVE to its parent interpolates evenly. All angles are tracked
 * UNWRAPPED and continuously in t (the returned `alpha` is the entry's
 * continuous anchor angle), so the rotation never jumps by 2π mid-morph.
 * Parents are resolved recursively on demand; results are memoized per
 * (entries, t, entry index).
 *
 * * the angles progress evenly unless a frame is shorter than it is thick
 *   (`calcAngleProgress`): a branch shrinking to such a nub keeps its own
 *   direction while it retracts, instead of being swung halfway onto the
 *   nub's direction when half of it is left
 */
const getMorphedSkeleton$ = memoize(function(
        entries: MorphEntry[],
        t: number,
        i: number) {

    const { skelPssA, skelPssB, ra, rb, glue } = entries[i];

    // the angles' progress
    const s = calcAngleProgress(skelPssA, skelPssB, ra, rb, t);

    // Length + knot-angle interpolation (not a control-point lerp).
    let pss = intrinsicSkeletonLerp(skelPssA, skelPssB, t, s);

    // Continuous anchor angle (matches intrinsicSkeletonLerp's φ0(s)).
    const ψsAe = unwrappedChordAngles$(skelPssA);
    const ψsBe = unwrappedChordAngles$(skelPssB);
    const φ0A = ψsAe[0];
    const φ0B = ψsBe[0];
    let α = φ0A + s*wrapAngle(φ0B - φ0A);

    if (glue === undefined) {
        // No-net-rotation gauge (free-floating = trunk; children ride it
        // via glue): the intrinsic lerp anchors orientation at the route's
        // START tangent, so when the two turning profiles differ by ~±2π
        // of integrated bend (unequal U-turn folds, M→N) all downstream
        // material orbits a full turn just to land where it started.
        // Counter-rotate the WHOLE-TURN part of the material's
        // length-weighted mean orientation sweep, as the angles progress
        // (`s`), about the skeleton's own mean point - 2π-multiples are
        // exact at t=0/1, the
        // dominant material stays put and the folds unroll locally. The
        // fractional part is genuine rotation and is kept. Skipped at
        // EXACTLY t=0/1: ρ there is a whole turn = identity only up to
        // float dust, which breaks the bit-exact seam coincidence the
        // boolean union needs (the skip is the continuous limit).
        const m = t === 0 || t === 1
            ? 0
            : netTurns(ψsAe, ψsBe, skelPssA, skelPssB);
        if (m !== 0) {
            const ρ = -s*2*π*m;
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
    const parent = entries[e];
    const { skelPssA: parentA, skelPssB: parentB } = parent;

    // Junction slides along the parent from k1 to k2.
    const kf = (1 - t)*k1 + t*k2;
    const parentPss = getMorphedSkeleton$(entries, t, e).pss;
    const target = pAtIndex(parentPss, kf);

    // parent frame rotation beyond its naive lerp - measured over the
    // parent's stretch around the junction (`calcReach`, `calcWindowFit`),
    // not by the tangent at the junction alone: there a short bend (e.g. a
    // fork's corner, present in one glyph and collapsed in the other) can
    // turn the tangent far more than the parent turns, swinging the child
    // round with it - each rotation fitted directly between the two
    // skeletons it compares, on the 2π branch of the tangents' (and blended
    // into them where a stretch has little extent)
    const reach = calcReach(entries[i]);
    const [hL, hR] = calcWindow(parentA, parentB, k1, k2, reach);
    const ψ = parentPsi(entries, t, e, kf);
    const ψA = staticPsiA(entries, e, k1);
    const ψB = staticPsiB(entries, e, k2);
    const rotA = calcBlendedRot(
        calcWindowFit(parentA, k1, parentPss, kf, hL, hR, reach), ψ - ψA);
    const rotB = calcBlendedRot(
        calcWindowFit(parentB, k2, parentPss, kf, hL, hR, reach), ψ - ψB);
    const rotAB = calcBlendedRot(
        calcWindowFit(parentA, k1, parentB, k2, hL, hR, reach), ψB - ψA);
    // (weighted as the child's own angles progress, so its angle relative
    // to the parent progresses by `s` too)
    let dψ = (1 - s)*rotA + s*rotB;

    // Take the shortest rotation RELATIVE to the parent, not in
    // absolute terms - so children follow their parent's rotation
    // instead of swinging the other way around (2π-multiple
    // correction, scaled by s: t=0/1 geometry unaffected). A
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

    const relΔ = junctionRot - rotAB;

    const { collapsed } = entries[i];
    dψ += collapsed === 'b' ? -s*relΔ
        : collapsed === 'a' ? (1 - s)*relΔ
        : s*(wrapAngle(relΔ) - relΔ);

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
    const ψs = unwrappedChordAngles$(pss);

    return alpha + (profileAngleAt(ψs, k) - ψs[0]);
}


/**
 * ψ at `k` on parent `e`'s static frame-a skeleton.
 */
function staticPsiA(
        entries: MorphEntry[],
        e: number,
        k: number): number {

    return profileAngleAt(unwrappedChordAngles$(entries[e].skelPssA), k);
}


/**
 * ψ at `k` on parent `e`'s static frame-b skeleton, re-anchored to the
 *  drawn parent's continuous anchor at t=1 (same value mod 2π).
 */
function staticPsiB(
        entries: MorphEntry[],
        e: number,
        k: number): number {

    const ψsA = unwrappedChordAngles$(entries[e].skelPssA);
    const ψsB = unwrappedChordAngles$(entries[e].skelPssB);
    const adj = ψsA[0] + wrapAngle(ψsB[0] - ψsA[0]) - ψsB[0];

    return profileAngleAt(ψsB, k) + adj;
}


/**
 * Returns how far along its parent (each way) a glued entry's frame
 * reaches: its own length (the longer frame's), between its junction disk's
 * radius and `REACH_RADII` of it.
 *
 * * at least the radius - a bend within the junction disk is the
 *   junction's own shape
 *
 * * at most a few radii - the frame stays the junction's: a child as long
 *   as its whole parent would otherwise take its frame from all of it,
 *   however the parent deforms far from the junction
 */
function calcReach(entry: MorphEntry): number {
    const { skelPssA, skelPssB, ra, rb } = entry;

    const L = max(sumOfChords(skelPssA), sumOfChords(skelPssB));
    const r = max(ra[ra.length - 1], rb[rb.length - 1]);

    return max(r, min(L, REACH_RADII*r));
}


/**
 * Returns the parent's stretch a glued child's frame is measured over, as
 * boundary-index offsets left and right of the junction: as far as `reach`
 * each way (by the two frames' mean segment length), within the parent.
 *
 * * index offsets, not lengths, so the stretch is the same material in
 *   every frame (the frames correspond boundary for boundary)
 *
 * @param pssA the parent's frame-a skeleton
 * @param pssB the parent's frame-b skeleton
 * @param k1 the junction's boundary index in frame a
 * @param k2 the junction's boundary index in frame b
 * @param reach the length to cover each way
 */
function calcWindow(
        pssA: number[][][],
        pssB: number[][][],
        k1: number,
        k2: number,
        reach: number): [number, number] {

    const n = pssA.length;

    function calcMeanLen(j: number): number {
        const iA = floor(k1) + j;
        const iB = floor(k2) + j;

        return (
            (iA >= 0 && iA < n ? chordLen(pssA[iA]) : 0) +
            (iB >= 0 && iB < n ? chordLen(pssB[iB]) : 0)
        ) / 2;
    }

    let hR = 0;
    for (let d = 0; d < reach && floor(max(k1, k2)) + hR < n; hR++) {
        d += calcMeanLen(hR);
    }

    let hL = 0;
    for (let d = 0; d < reach && floor(min(k1, k2)) - hL > 0; hL++) {
        d += calcMeanLen(-hL - 1);
    }

    return [hL, hR];
}


/**
 * Returns the rotation best taking the stretch of skeleton `pss0` around
 * boundary `k0` onto the stretch of `pss1` around `k1` (least squares,
 * the stretches' centroids matched), with how far to trust it (`w`).
 *
 * * `w` = 1 while both stretches spread (RMS distance from their centroid)
 *   at least `MAX_EXTENT` of `reach`, falling continuously to 0 at
 *   `MIN_EXTENT` - a stretch with (next to) no extent (e.g. collapsed in
 *   one glyph) leaves its direction to noise; continuous, as a stretch
 *   shrinks during the morph, so the rotation never jumps
 *
 * @param pss0 the first skeleton
 * @param k0 its junction's boundary index
 * @param pss1 the second skeleton (corresponding boundary for boundary)
 * @param k1 its junction's boundary index
 * @param hL the stretch's boundary-index offset left of the junction
 * @param hR the stretch's offset right of it
 * @param reach the length the stretch was meant to cover each way
 */
function calcWindowFit(
        pss0: number[][][],
        k0: number,
        pss1: number[][][],
        k1: number,
        hL: number,
        hR: number,
        reach: number): { θ: number; w: number } {

    const n = pss0.length;
    const ps0: number[][] = [];
    const ps1: number[][] = [];
    for (let j = -hL; j <= hR; j++) {
        ps0.push(pAtIndex(pss0, min(max(k0 + j, 0), n)));
        ps1.push(pAtIndex(pss1, min(max(k1 + j, 0), n)));
    }

    const [x0, y0] = calcCentroid(ps0);
    const [x1, y1] = calcCentroid(ps1);

    let c = 0;
    let s = 0;
    let ss0 = 0;
    let ss1 = 0;
    for (let m = 0; m < ps0.length; m++) {
        const ux = ps0[m][0] - x0;
        const uy = ps0[m][1] - y0;
        const vx = ps1[m][0] - x1;
        const vy = ps1[m][1] - y1;
        c += ux*vx + uy*vy;
        s += ux*vy - uy*vx;
        ss0 += ux*ux + uy*uy;
        ss1 += vx*vx + vy*vy;
    }

    // the smaller spread, as a fraction of the reach
    const spread = Math.sqrt(min(ss0, ss1)/ps0.length)/reach;
    const w = min(max(
        (spread - MIN_EXTENT)/(MAX_EXTENT - MIN_EXTENT), 0), 1);

    return { θ: atan2(s, c), w };
}


/**
 * Returns the fitted rotation `θ` on the 2π branch nearest `ref` (the
 * tangents' rotation), blended into `ref` by the fit's trust `w`.
 */
function calcBlendedRot(
        fit: { θ: number; w: number },
        ref: number): number {

    const { θ, w } = fit;

    return ref + w*wrapAngle(θ - ref);
}


/** Returns the mean of the points. */
function calcCentroid(ps: number[][]): number[] {
    let x = 0;
    let y = 0;
    for (const [px, py] of ps) { x += px; y += py; }

    return [x/ps.length, y/ps.length];
}


/** Returns the total chord length of the beziers. */
function sumOfChords(pss: number[][][]): number {
    let L = 0;
    for (const ps of pss) { L += chordLen(ps); }

    return L;
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
        unwrappedChordAngles$(e.skelPssA),
        unwrappedChordAngles$(e.skelPssB),
        e.skelPssA, e.skelPssB
    );
}


export { getMorphedSkeleton$, entryNetTurns }
