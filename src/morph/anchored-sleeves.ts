import { fromTo, getTAtLength, toCubic, evalDeCasteljau } from 'flo-bezier3';
import { distributeBezierListsEvenly } from './distribute-beziers-evenly.js';
import { clamp } from '../utils/clamp.js';
import { length$ } from './fs/length.js';
import { sum } from '../utils/sum.js';
import { lenOf$ } from './segment-graph/len-of.js';

const { atan2, hypot, PI: π } = Math;

const EPS_LEN = 1e-9;


/**
 * One side of a morph entry's boundary, anchored to the maximal disks.
 *
 * Per resampled skeleton segment (in the side's outline travel direction:
 * `out` runs boundary k → k+1, `back` runs k+1 → k):
 * - `anchorsA`/`anchorsB`: `[fromθ, fromρ, toθ, toρ, fromτ, toτ]` - the
 *   segment's two boundary anchors in the local disk frame of their
 *   skeleton boundary (θ = angle in the (T, N) basis, ρ = distance / disk
 *   radius, so the anchor rides the interpolated maximal disk) plus the
 *   boundary's TRAVEL-direction tangent angle τ at each anchor in the same
 *   basis (NaN when degenerate). In/out τ's of a joint live on ADJACENT
 *   segments, so corners keep their (interpolated) opening angle while
 *   smooth joints stay G1 at every t.
 * - `piecesA`/`piecesB`: the boundary pieces between the two anchors,
 *   normalized into the anchors' chord frame, control-point corresponding.
 */
interface SleeveSide {
    readonly anchorsA: number[][];
    readonly anchorsB: number[][];
    readonly piecesA: number[][][][];
    readonly piecesB: number[][][][];
}


/** Everything of one frame needed to anchor its boundary. */
interface SleeveFrame {
    /** per original skeleton edge: boundary pieces per side (outline direction) */
    readonly edges: { out: number[][][]; back: number[][][] }[];
    /** normalized arc-length knots of the original skeleton edges */
    readonly knots: number[];
    /** this frame's breakpoints (monotone, may repeat for collapsed sections) */
    readonly us: number[];
    /** the resampled skeleton (cut at `us`) */
    readonly bz: number[][][];
    /** maximal-disk radius per resampled segment boundary */
    readonly radii: number[];
}


/** Normalized cumulative arc-length knots of a skeleton bezier list. */
function skeletonKnots(
        pss: number[][][]): number[] {

    const lens = pss.map(length$);
    const total = sum(lens);

    const knots = [0];
    let cum = 0;
    for (const l of lens) {
        cum += l;
        knots.push(total > 0 ? cum/total : 0);
    }

    knots[knots.length - 1] = 1;

    return knots;
}


/**
 * Builds both anchored boundary sides of a matched pair: each frame's
 * boundary is cut at its own breakpoints (paired index-for-index between the
 * frames; by boundary arc fraction within each original edge), anchors are
 * encoded in their disk's local frame, and the in-between pieces are
 * resampled to correspond and normalized into their chord frames.
 */
function buildSleeveSides(
        A: SleeveFrame,
        B: SleeveFrame): { out: SleeveSide; back: SleeveSide } {

    return {
        out: buildSide(A, B, 'out'),
        back: buildSide(A, B, 'back')
    };
}


function buildSide(
        A: SleeveFrame,
        B: SleeveFrame,
        side: 'out' | 'back'): SleeveSide {

    const segsA = cutSide(A.edges, A.knots, A.us, side);
    const segsB = cutSide(B.edges, B.knots, B.us, side);
    const TsA = boundaryTangents(A.bz);
    const TsB = boundaryTangents(B.bz);

    const anchorsA: number[][] = [];
    const anchorsB: number[][] = [];
    const piecesA: number[][][][] = [];
    const piecesB: number[][][][] = [];

    const isOut = side === 'out';
    for (let k = 0; k < segsA.length; k++) {
        const sA = segsA[k];
        const sB = segsB[k];

        // Degenerate sides: a fully degenerate pair becomes its chords; a
        // one-sided degenerate (e.g. a collapsed topology frame) mirrors the
        // real side's structure so control points still correspond.
        let pA = sA.pieces;
        let pB = sB.pieces;
        const degA = lenOf$(pA) < EPS_LEN;
        const degB = lenOf$(pB) < EPS_LEN;
        if (degA && degB) {
            pA = [[sA.from, sA.to]];
            pB = [[sB.from, sB.to]];
        } else if (degB) {
            pB = pA.map(ps => ps.map(() => [sB.from[0], sB.from[1]]));
        } else if (degA) {
            pA = pB.map(ps => ps.map(() => [sA.from[0], sA.from[1]]));
        } else {
            [pA, pB] = distributeBezierListsEvenly(pA, pB);
        }

        const bidxFrom = isOut ? k : k + 1;
        const bidxTo = isOut ? k + 1 : k;

        anchorsA.push([
            ...polarAnchor(sA.from, bidxFrom, A, TsA),
            ...polarAnchor(sA.to, bidxTo, A, TsA),
            tangentAngle(dirAtStart(pA[0]), TsA[bidxFrom]),
            tangentAngle(dirAtEnd(pA[pA.length - 1]), TsA[bidxTo])
        ]);
        anchorsB.push([
            ...polarAnchor(sB.from, bidxFrom, B, TsB),
            ...polarAnchor(sB.to, bidxTo, B, TsB),
            tangentAngle(dirAtStart(pB[0]), TsB[bidxFrom]),
            tangentAngle(dirAtEnd(pB[pB.length - 1]), TsB[bidxTo])
        ]);

        piecesA.push(normalizeSeg(pA, sA.from, sA.to));
        piecesB.push(normalizeSeg(pB, sB.from, sB.to));
    }

    fillDegenerateThetas(anchorsA, isOut);
    fillDegenerateThetas(anchorsB, isOut);

    unifySeamAnchors(anchorsA, segsA, isOut);
    unifySeamAnchors(anchorsB, segsB, isOut);

    return { anchorsA, anchorsB, piecesA, piecesB };
}


/**
 * Coincident seam anchors (segment k's entry point = its neighbor's exit
 * point at the same boundary cut) must share ONE polar representation:
 * they're stored independently, and independent degenerate-θ fills (or
 * float noise) make the same boundary point interpolate to two DIFFERENT
 * places mid-morph - the seam opens and the assembly bridges it with a
 * reversing micro-line (visible jagged stitches).
 */
function unifySeamAnchors(
        anchors: number[][],
        segs: { from: number[]; to: number[] }[],
        isOut: boolean): void {

    const EPS_SEAM = 1e-4;
    for (let j = 1; j < anchors.length; j++) {
        if (isOut) {
            // seam at boundary index j: seg j-1's `to` ↔ seg j's `from`
            const p = segs[j - 1].to;
            const q = segs[j].from;
            if (hypot(p[0] - q[0], p[1] - q[1]) < EPS_SEAM) {
                anchors[j][0] = anchors[j - 1][2];
                anchors[j][1] = anchors[j - 1][3];
            }
        } else {
            // back side: seg j-1's `from` ↔ seg j's `to` (both at index j)
            const p = segs[j - 1].from;
            const q = segs[j].to;
            if (hypot(p[0] - q[0], p[1] - q[1]) < EPS_SEAM) {
                anchors[j - 1][0] = anchors[j][2];
                anchors[j - 1][1] = anchors[j][3];
            }
        }
    }
}


/**
 * Cuts one side's boundary at the shared skeleton breakpoints: each `us`
 * interval lies within a single original edge; its boundary sub-piece is the
 * corresponding arc-fraction range of that edge's side pieces (skeleton
 * fraction f maps to boundary arc fraction f on the out side, 1−f on the
 * back side since back pieces run against the skeleton).
 */
function cutSide(
        edges: { out: number[][][]; back: number[][][] }[],
        knots: number[],
        us: number[],
        side: 'out' | 'back'
        ): { pieces: number[][][]; from: number[]; to: number[] }[] {

    const segs: { pieces: number[][][]; from: number[]; to: number[] }[] = [];

    for (let k = 0; k < us.length - 1; k++) {
        const uA = us[k];
        const uB = us[k + 1];

        // The midpoint uniquely identifies the original edge containing [uA,uB].
        const mid = (uA + uB) / 2;
        let j = 0;
        while (j < knots.length - 2 && knots[j + 1] <= mid) { j++; }

        const span = knots[j + 1] - knots[j];
        const fA = span <= 0 ? 0 : clamp((uA - knots[j]) / span, 0, 1);
        const fB = span <= 0 ? 1 : clamp((uB - knots[j]) / span, 0, 1);

        const pieces = side === 'out'
            ? cutByArcFraction(edges[j].out, fA, fB)
            : cutByArcFraction(edges[j].back, 1 - fB, 1 - fA);

        const from = pieces[0][0];
        const last = pieces[pieces.length - 1];
        segs.push({ pieces, from, to: last[last.length - 1] });
    }

    return segs;
}


/** The sub-list of `pieces` between arc fractions `f0` ≤ `f1` (as cubics). */
function cutByArcFraction(
        pieces: number[][][],
        f0: number,
        f1: number): number[][][] {

    const lens = pieces.map(length$);
    const total = sum(lens);

    if (total < EPS_LEN) {
        const p = pieces[0]?.[0] ?? [0, 0];
        return [[p, p]];
    }

    const s0 = f0 * total;
    const s1 = f1 * total;

    const out: number[][][] = [];
    let c = 0;
    for (let i = 0; i < pieces.length; i++) {
        const a = Math.max(s0, c);
        const b = Math.min(s1, c + lens[i]);
        if (b - a > EPS_LEN) {
            const t0 = clamp(getTAtLength(pieces[i], a - c), 0, 1);
            const t1 = clamp(getTAtLength(pieces[i], b - c), 0, 1);
            out.push(toCubic(fromTo(pieces[i], t0, t1)));
        }
        c += lens[i];
    }

    if (out.length === 0) {
        // Zero-length range: a single point.
        let cc = 0;
        for (let i = 0; i < pieces.length; i++) {
            if (s0 <= cc + lens[i] || i === pieces.length - 1) {
                const t0 = clamp(getTAtLength(pieces[i], s0 - cc), 0, 1);
                const p = evalDeCasteljau(pieces[i], t0);
                return [[p, p]];
            }
            cc += lens[i];
        }
    }

    return out;
}


/**
 * The anchor `c` in the local disk frame of skeleton boundary `bidx`:
 * `[θ, ρ]` with `c = p + ρ·r·(cos θ·T + sin θ·N)`. θ is NaN when the anchor
 * coincides with the center (filled in later from a neighbor).
 */
function polarAnchor(
        c: number[],
        bidx: number,
        F: SleeveFrame,
        Ts: number[][]): number[] {

    const p = boundaryPoint(F.bz, bidx);
    const r = F.radii[bidx];
    const ux = c[0] - p[0];
    const uy = c[1] - p[1];
    const d = hypot(ux, uy);

    if (d < EPS_LEN) { return [NaN, 1]; }

    const T = Ts[bidx];
    const N = [-T[1], T[0]];
    const theta = atan2(ux*N[0] + uy*N[1], ux*T[0] + uy*T[1]);
    const rho = r > EPS_LEN ? clamp(d / r, 0, 2) : 1;

    return [theta, rho];
}


/** Fills NaN anchor angles from the nearest defined one on the same side. */
function fillDegenerateThetas(anchors: number[][], isOut: boolean): void {
    // Flatten in travel order: [seg0 from, seg0 to, seg1 from, ...].
    const idx: [number, number][] = [];
    for (let k = 0; k < anchors.length; k++) { idx.push([k, 0], [k, 2]); }

    const theta = (i: number) => anchors[idx[i][0]][idx[i][1]];

    for (let i = 0; i < idx.length; i++) {
        if (!Number.isNaN(theta(i))) { continue; }

        let filled = NaN;
        for (let o = 1; o < idx.length && Number.isNaN(filled); o++) {
            if (i - o >= 0 && !Number.isNaN(theta(i - o))) { filled = theta(i - o); }
            else if (i + o < idx.length && !Number.isNaN(theta(i + o))) { filled = theta(i + o); }
        }
        if (Number.isNaN(filled)) { filled = isOut ? π/2 : -π/2; }

        anchors[idx[i][0]][idx[i][1]] = filled;
    }
}


/** The direction's angle in the (T, N) basis (NaN for a zero direction). */
function tangentAngle(v: number[], T: number[]): number {
    if (v[0] === 0 && v[1] === 0) { return NaN; }
    const N = [-T[1], T[0]];
    return atan2(v[0]*N[0] + v[1]*N[1], v[0]*T[0] + v[1]*T[1]);
}


/** Pieces expressed in the chord frame of `e0` → `e1` (chord maps to (0,0)→(1,0)). */
function normalizeSeg(
        pieces: number[][][],
        e0: number[],
        e1: number[]): number[][][] {

    const dx = e1[0] - e0[0];
    const dy = e1[1] - e0[1];
    let den = dx*dx + dy*dy;
    // Degenerate chord: translation only (mirrored at reconstruction).
    let bx = dx; let by = dy;
    if (den < EPS_LEN*EPS_LEN) { bx = 1; by = 0; den = 1; }

    return pieces.map(ps => ps.map(p => {
        const ux = p[0] - e0[0];
        const uy = p[1] - e0[1];
        return [(bx*ux + by*uy) / den, (-by*ux + bx*uy) / den];
    }));
}


/**
 * Unit tangent of the skeleton at each segment boundary (same rule at build
 * and reconstruction time so t=0/1 are exact). Degenerate (zero-length)
 * segments inherit the nearest real neighbor's tangent - an arbitrary
 * fallback would encode anchor angles in a bogus frame that the drawn
 * (interpolated) frame doesn't match mid-morph.
 */
function boundaryTangents(bz: number[][][]): number[][] {
    const dirs: number[][] = [];
    for (let k = 0; k < bz.length; k++) { dirs.push(dirAtStart(bz[k])); }
    dirs.push(dirAtEnd(bz[bz.length - 1]));

    const isZero = (v: number[]) => v[0] === 0 && v[1] === 0;
    for (let k = 1; k < dirs.length; k++) {
        if (isZero(dirs[k])) { dirs[k] = dirs[k - 1]; }
    }
    for (let k = dirs.length - 2; k >= 0; k--) {
        if (isZero(dirs[k])) { dirs[k] = dirs[k + 1]; }
    }

    return dirs.map(unit);
}


function boundaryPoint(bz: number[][][], k: number): number[] {
    if (k < bz.length) { return bz[k][0]; }
    const last = bz[bz.length - 1];
    return last[last.length - 1];
}


function unit(v: number[]): number[] {
    const h = hypot(v[0], v[1]);
    return h > 0 ? [v[0]/h, v[1]/h] : [1, 0];
}


function dirAtStart(ps: number[][]): number[] {
    const p0 = ps[0];
    for (let i = 1; i < ps.length; i++) {
        const [x, y] = [ps[i][0] - p0[0], ps[i][1] - p0[1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];  // degenerate - filled from a neighbor by boundaryTangents
}


function dirAtEnd(ps: number[][]): number[] {
    const pE = ps[ps.length - 1];
    for (let i = ps.length - 2; i >= 0; i--) {
        const [x, y] = [pE[0] - ps[i][0], pE[1] - ps[i][1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];  // degenerate - filled from a neighbor by boundaryTangents
}


export type { SleeveSide, SleeveFrame }
export {
    buildSleeveSides,
    skeletonKnots,
    boundaryTangents,
    boundaryPoint
}

