import { evalDeCasteljau, fromTo, getTAtLength, length, toCubic } from 'flo-bezier3';
import { unwrappedChordAngles } from './intrinsic-skeleton.js';
import { clamp } from '../utils/clamp.js';

const { abs, max, min, round } = Math;


/**
 * A feature-aligned, non-linear correspondence between two branches:
 * `usA[i]` on branch A corresponds to `usB[i]` on branch B (both monotone,
 * equal length). Repeated consecutive values on one side mean that section
 * of the OTHER branch has no counterpart and collapses to that point during
 * the morph (interior or endpoint deletions/insertions).
 */
interface BranchAlignment {
    readonly usA: number[];
    readonly usB: number[];
    /** breakpoint index of each requested anchor pair (fork matches) */
    readonly anchorIdx: number[];
}


/** A known feature correspondence (e.g. matched children's forks). */
interface AnchorPair {
    readonly uA: number;
    readonly uB: number;
}


// ---- Cost model -------------------------------------------------------------

/** radius-profile difference weight */
const W_RADIUS = 1;
/** turning-rate difference weight */
const W_TURN = 0.15;
/** affine gap penalties (deletion/insertion of a section) */
const GAP_OPEN = 0.5;
const GAP_EXTEND = 0.06;


/**
 * Aligns two branches with a monotone, feature-based warp: anchors (known
 * feature correspondences, e.g. matched children's forks) are HARD
 * constraints - the branches are aligned piecewise between consecutive
 * anchors with an affine-gap Gotoh alignment on radius + turning profiles.
 * The result pairs breakpoints non-linearly and allows sections of either
 * branch to be deleted (paired to a point), including at the endpoints.
 *
 * The returned breakpoints include both frames' original knots (so every
 * paired interval lies within a single original segment on its side) and
 * the anchor pairs exactly (anchors violating joint monotonicity are
 * dropped: their `anchorIdx` is -1).
 */
function alignBranches(
        bzA: number[][][],
        rdA: number[],
        bzB: number[][][],
        rdB: number[],
        anchors: AnchorPair[],
        unitA: number,
        unitB: number): BranchAlignment {

    const knotsA = arcKnots(bzA);
    const knotsB = arcKnots(bzB);

    const nA = sampleCount(bzA);
    const nB = sampleCount(bzB);

    // Sort anchors and keep only a jointly monotone subset.
    const order = anchors.map((_, n) => n)
        .sort((x, y) => anchors[x].uA - anchors[y].uA);
    const kept: number[] = [];
    let lastA = 0;
    let lastB = 0;
    for (const n of order) {
        const { uA, uB } = anchors[n];
        if (uA > lastA + 1e-9 && uB > lastB + 1e-9 &&
            uA < 1 - 1e-9 && uB < 1 - 1e-9) {
            kept.push(n);
            lastA = uA;
            lastB = uB;
        }
    }

    // Align each stretch between consecutive anchors independently.
    const cuts: AnchorPair[] = [
        { uA: 0, uB: 0 },
        ...kept.map(n => anchors[n]),
        { uA: 1, uB: 1 }
    ];

    let pairs: [number, number][] = [];
    for (let m = 0; m < cuts.length - 1; m++) {
        const a0 = cuts[m].uA;
        const a1 = cuts[m + 1].uA;
        const b0 = cuts[m].uB;
        const b1 = cuts[m + 1].uB;

        const nAs = max(2, round(nA * (a1 - a0)));
        const nBs = max(2, round(nB * (b1 - b0)));
        const fA = sampleFeatures(bzA, rdA, knotsA, nAs, unitA, a0, a1);
        const fB = sampleFeatures(bzB, rdB, knotsB, nBs, unitB, b0, b1);

        const path = gotoh(fA, fB);

        const start = m === 0 ? 0 : 1;  // the joint pair is already in
        for (let c = start; c < path.length; c++) {
            const [i, j] = path[c];
            pairs.push([fA.u[i], fB.u[j]]);
        }
    }

    return toBreakpoints(pairs, knotsA, knotsB, anchors, kept);
}


// ---- Feature sampling -------------------------------------------------------

interface Samples {
    readonly u: number[];
    readonly r: number[];
    readonly turn: number[];
}

function sampleCount(bz: number[][][]): number {
    return clamp(2 * bz.length, 24, 160);
}

/** Normalized cumulative arc-length knots. */
function arcKnots(bz: number[][][]): number[] {
    const lens = bz.map(ps => length([0, 1], ps));
    const total = lens.reduce((s, l) => s + l, 0);

    const knots = [0];
    let cum = 0;
    for (const l of lens) { cum += l; knots.push(total > 0 ? cum/total : 0); }
    knots[knots.length - 1] = 1;

    return knots;
}

function sampleFeatures(
        bz: number[][][],
        rd: number[],
        knots: number[],
        n: number,
        unit: number,
        u0: number,
        u1: number): Samples {

    const φs = unwrappedChordAngles(bz);

    const u: number[] = [];
    const r: number[] = [];
    const φ: number[] = [];
    for (let i = 0; i < n; i++) {
        const ui = u0 + (u1 - u0) * i / (n - 1);
        u.push(ui);
        r.push(valueAt(rd, knots, ui) / unit);
        φ.push(angleAt(φs, knots, ui));
    }

    // Turning rate per normalized arc (central differences).
    const turn: number[] = [];
    for (let i = 0; i < n; i++) {
        const i0 = max(0, i - 1);
        const i1 = min(n - 1, i + 1);
        turn.push((φ[i1] - φ[i0]) / (u[i1] - u[i0]));
    }

    return { u, r, turn };
}

/** Piecewise-linear value over `knots` at normalized position `u`. */
function valueAt(vals: number[], knots: number[], u: number): number {
    let j = 0;
    while (j < knots.length - 2 && knots[j + 1] <= u) { j++; }
    const span = knots[j + 1] - knots[j];
    const f = span <= 0 ? 0 : clamp((u - knots[j]) / span, 0, 1);

    return vals[j]*(1 - f) + vals[j + 1]*f;
}

/** The unwrapped angle profile (per segment, at midpoints) at position `u`. */
function angleAt(φs: number[], knots: number[], u: number): number {
    const n = φs.length;
    if (n === 1) { return φs[0]; }

    // Segment k's angle sits at its arc midpoint.
    let j = 0;
    while (j < knots.length - 2 && knots[j + 1] <= u) { j++; }
    const mid = (knots[j] + knots[j + 1]) / 2;

    if (u <= mid) {
        if (j === 0) { return φs[0]; }
        const prev = (knots[j - 1] + knots[j]) / 2;
        const f = clamp((u - prev) / (mid - prev), 0, 1);
        return φs[j - 1]*(1 - f) + φs[j]*f;
    }
    if (j === n - 1) { return φs[n - 1]; }
    const next = (knots[j + 1] + knots[j + 2]) / 2;
    const f = clamp((u - mid) / (next - mid), 0, 1);
    return φs[j]*(1 - f) + φs[j + 1]*f;
}


// ---- Affine-gap alignment (Gotoh) -------------------------------------------

type Move = 0 | 1 | 2;  // 0 = diag (match), 1 = gap in B (A advances), 2 = gap in A

function gotoh(
        fA: Samples,
        fB: Samples): [number, number][] {

    const nA = fA.u.length;
    const nB = fB.u.length;

    // Turning magnitude is mirror-invariant: mirrored pairs (e.g. "(" vs
    // ")") have OPPOSITE-sign turning - comparing signed rates would make
    // the whole diagonal expensive and push the alignment into huge
    // spurious gap runs.
    const cost = (i: number, j: number): number =>
        W_RADIUS*abs(fA.r[i] - fB.r[j])
        + W_TURN*abs(abs(fA.turn[i]) - abs(fB.turn[j])) / (2*Math.PI);

    const INF = Infinity;
    // M = last move was a match; Ix = gap in B (A advancing); Iy = gap in A.
    const M: number[][] = [];
    const Ix: number[][] = [];
    const Iy: number[][] = [];
    const fromM: Move[][] = [];
    for (let i = 0; i < nA; i++) {
        M.push(new Array(nB).fill(INF));
        Ix.push(new Array(nB).fill(INF));
        Iy.push(new Array(nB).fill(INF));
        fromM.push(new Array(nB).fill(0) as Move[]);
    }

    M[0][0] = cost(0, 0);
    for (let i = 1; i < nA; i++) {
        Ix[i][0] = (i === 1 ? M[0][0] + GAP_OPEN : Ix[i - 1][0]) + GAP_EXTEND;
    }
    for (let j = 1; j < nB; j++) {
        Iy[0][j] = (j === 1 ? M[0][0] + GAP_OPEN : Iy[0][j - 1]) + GAP_EXTEND;
    }

    for (let i = 1; i < nA; i++) {
        for (let j = 1; j < nB; j++) {
            const prevM = M[i - 1][j - 1];
            const prevIx = Ix[i - 1][j - 1];
            const prevIy = Iy[i - 1][j - 1];
            const best = min(prevM, prevIx, prevIy);
            M[i][j] = best + cost(i, j);
            fromM[i][j] = best === prevM ? 0 : best === prevIx ? 1 : 2;

            Ix[i][j] = min(M[i - 1][j] + GAP_OPEN, Ix[i - 1][j]) + GAP_EXTEND;
            Iy[i][j] = min(M[i][j - 1] + GAP_OPEN, Iy[i][j - 1]) + GAP_EXTEND;
        }
    }

    // Trace back from the best terminal state.
    const path: [number, number][] = [];
    let i = nA - 1;
    let j = nB - 1;
    let state: Move =
        M[i][j] <= Ix[i][j] && M[i][j] <= Iy[i][j] ? 0
        : Ix[i][j] <= Iy[i][j] ? 1 : 2;

    while (i > 0 || j > 0) {
        path.push([i, j]);
        if (state === 0) {
            const s = fromM[i][j];
            i--; j--;
            state = s;
        } else if (state === 1) {
            state = i > 1 && Ix[i - 1][j] <= M[i - 1][j] + GAP_OPEN ? 1 : 0;
            i--;
            if (i === 0 && j > 0) { state = 2; }
        } else {
            state = j > 1 && Iy[i][j - 1] <= M[i][j - 1] + GAP_OPEN ? 2 : 0;
            j--;
            if (j === 0 && i > 0) { state = 1; }
        }
    }
    path.push([0, 0]);
    path.reverse();

    return path;
}


// ---- Alignment path → paired breakpoints ------------------------------------

function toBreakpoints(
        rawPairs: [number, number][],
        knotsA: number[],
        knotsB: number[],
        anchors: AnchorPair[],
        kept: number[]): BranchAlignment {

    // Merge both frames' original knots into the path (each paired interval
    // must lie within one original segment per side): walk the path pairs
    // and insert interior knots with the SAME local linear map on both
    // sides - monotone by construction.
    const pairs: [number, number][] = [rawPairs[0]];
    let ia = 1;
    let ib = 1;
    for (let m = 0; m < rawPairs.length - 1; m++) {
        const [a0, b0] = rawPairs[m];
        const [a1, b1] = rawPairs[m + 1];

        const ins: [number, number][] = [];
        while (ia < knotsA.length - 1 && knotsA[ia] <= a0 + 1e-12) { ia++; }
        while (ia < knotsA.length - 1 && knotsA[ia] < a1 - 1e-12) {
            const f = a1 - a0 <= 0 ? 0 : (knotsA[ia] - a0) / (a1 - a0);
            ins.push([knotsA[ia], b0 + f*(b1 - b0)]);
            ia++;
        }
        while (ib < knotsB.length - 1 && knotsB[ib] <= b0 + 1e-12) { ib++; }
        while (ib < knotsB.length - 1 && knotsB[ib] < b1 - 1e-12) {
            const f = b1 - b0 <= 0 ? 0 : (knotsB[ib] - b0) / (b1 - b0);
            ins.push([a0 + f*(a1 - a0), knotsB[ib]]);
            ib++;
        }

        // Same linear map on both sides ⇒ sorting by uA also sorts uB.
        ins.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]));
        pairs.push(...ins, rawPairs[m + 1]);
    }

    // Dedupe pairs that are identical on both sides (keep anchors).
    const keptPairs: [number, number][] =
        kept.map(n => [anchors[n].uA, anchors[n].uB]);
    const usA: number[] = [];
    const usB: number[] = [];
    const anchorIdx: number[] = anchors.map(() => -1);
    for (const [a, b] of pairs) {
        const last = usA.length - 1;
        const ki = keptPairs.findIndex(p =>
            abs(p[0] - a) < 1e-12 && abs(p[1] - b) < 1e-12);
        if (last >= 0 && abs(usA[last] - a) < 1e-9 && abs(usB[last] - b) < 1e-9) {
            if (ki >= 0) { anchorIdx[kept[ki]] = last; }
            continue;
        }
        usA.push(a);
        usB.push(b);
        if (ki >= 0) { anchorIdx[kept[ki]] = usA.length - 1; }
    }

    // Guard the ends.
    usA[0] = 0; usB[0] = 0;
    usA[usA.length - 1] = 1; usB[usB.length - 1] = 1;

    return { usA, usB, anchorIdx };
}


// ---- Paired resampling -------------------------------------------------------

/**
 * Resamples one frame at its (monotone, possibly repeating) breakpoints:
 * beziers per interval (degenerate point-cubics for zero-length intervals)
 * and the radius at each breakpoint.
 */
function resampleAt(
        bz: number[][][],
        rd: number[],
        us: number[]): { beziers: number[][][]; radii: number[] } {

    const knots = arcKnots(bz);
    const lens = bz.map(ps => length([0, 1], ps));
    const total = lens.reduce((s, l) => s + l, 0);

    const beziers: number[][][] = [];
    for (let s = 0; s < us.length - 1; s++) {
        const uA = us[s];
        const uB = us[s + 1];

        // The midpoint identifies the original segment containing [uA,uB].
        const mid = (uA + uB) / 2;
        let j = 0;
        while (j < knots.length - 2 && knots[j + 1] <= mid) { j++; }

        const span = knots[j + 1] - knots[j];
        const sA = span <= 0 ? 0 : (uA - knots[j]) / span * lens[j];
        const sB = span <= 0 ? 0 : (uB - knots[j]) / span * lens[j];

        if (uB - uA <= 1e-12 || lens[j] === 0) {
            const t0 = lens[j] === 0 ? 0 : clamp(getTAtLength(bz[j], sA), 0, 1);
            const p = evalDeCasteljau(bz[j], t0);
            beziers.push([[...p], [...p], [...p], [...p]]);
        } else {
            const t0 = clamp(getTAtLength(bz[j], sA), 0, 1);
            const t1 = clamp(getTAtLength(bz[j], sB), 0, 1);
            beziers.push(toCubic(fromTo(bz[j], t0, t1)));
        }
    }

    const radii = us.map(u => valueAt(rd, knots, u));

    return { beziers, radii };
}


export { alignBranches, resampleAt }
export type { BranchAlignment, AnchorPair }
