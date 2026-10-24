import { getTAtLength, evalDeCasteljau } from 'flo-bezier3';
import { distributeBezierListsEvenly } from './distribute-beziers-evenly.js';
import { clamp } from '../utils/clamp.js';
import { length$ } from './fs/length.js';
import { sum } from '../utils/sum.js';
import { lenOf$ } from './segment-tree/len-of.js';
import { knotIdxAt } from './fs/knot-idx-at.js';
import { toChordFrame } from './fs/to-chord-frame.js';
import { dirAtStart } from './fs/dir-at-start.js';
import { dirAtEnd } from './fs/dir-at-end.js';
import { cubicSection } from './fs/cubic-section.js';
import { fillGaps } from './fs/fill-gaps.js';

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
    readonly sleeves: readonly { out: number[][][]; back: number[][][] }[];
    /** normalized arc-length knots of the original skeleton edges */
    readonly knots: number[];
    /** this frame's breakpoints (monotone, may repeat for collapsed sections) */
    readonly us: number[];
    /** the resampled skeleton (cut at `us`) */
    readonly bz: number[][][];
    /** maximal-disk radius per resampled segment boundary */
    readonly radii: number[];
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

    const segsA = cutSide(A.sleeves, A.knots, A.us, side);
    const segsB = cutSide(B.sleeves, B.knots, B.us, side);
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

        anchorsA.push(anchorRow(sA, pA, bidxFrom, bidxTo, A, TsA));
        anchorsB.push(anchorRow(sB, pB, bidxFrom, bidxTo, B, TsB));

        // pieces in their anchors' chord frame
        piecesA.push(pA.map(ps => toChordFrame(ps, sA.from, sA.to)));
        piecesB.push(pB.map(ps => toChordFrame(ps, sB.from, sB.to)));
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
        // the seam at boundary index j joins seg `p`'s `to` (in travel
        // order) to seg `n`'s `from` - out: j-1 → j; back: j → j-1
        const [p, n] = isOut ? [j - 1, j] : [j, j - 1];
        const a = segs[p].to;
        const b = segs[n].from;
        if (hypot(a[0] - b[0], a[1] - b[1]) < EPS_SEAM) {
            anchors[n][0] = anchors[p][2];
            anchors[n][1] = anchors[p][3];
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
        sleeves: readonly { out: number[][][]; back: number[][][] }[],
        knots: number[],
        us: number[],
        side: 'out' | 'back'
        ): { pieces: number[][][]; from: number[]; to: number[] }[] {

    const segs: { pieces: number[][][]; from: number[]; to: number[] }[] = [];

    for (let k = 0; k < us.length - 1; k++) {
        const uA = us[k];
        const uB = us[k + 1];

        // The midpoint uniquely identifies the original edge containing [uA,uB].
        const j = knotIdxAt(knots, (uA + uB) / 2);

        const span = knots[j + 1] - knots[j];
        const fA = span <= 0 ? 0 : clamp((uA - knots[j]) / span, 0, 1);
        const fB = span <= 0 ? 1 : clamp((uB - knots[j]) / span, 0, 1);

        const pieces = side === 'out'
            ? cutByArcFraction(sleeves[j].out, fA, fB)
            : cutByArcFraction(sleeves[j].back, 1 - fB, 1 - fA);

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
            out.push(cubicSection(pieces[i], a - c, b - c));
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
/**
 * A segment's anchor row (see `SleeveSide`): its two boundary anchors in
 * polar disk-frame coordinates, then the travel-direction tangent angle of
 * its boundary pieces at each anchor.
 *
 * @param seg the cut segment's two anchor points
 * @param ps its boundary pieces (travel order)
 * @param bidxFrom the skeleton boundary index of its `from` anchor
 * @param bidxTo the skeleton boundary index of its `to` anchor
 * @param F the frame
 * @param Ts the frame's boundary tangents
 */
function anchorRow(
        seg: { from: number[]; to: number[] },
        ps: number[][][],
        bidxFrom: number,
        bidxTo: number,
        F: SleeveFrame,
        Ts: number[][]): number[] {

    return [
        ...polarAnchor(seg.from, bidxFrom, F, Ts),
        ...polarAnchor(seg.to, bidxTo, F, Ts),
        tangentAngle(dirAtStart(ps[0]), Ts[bidxFrom]),
        tangentAngle(dirAtEnd(ps[ps.length - 1]), Ts[bidxTo])
    ];
}


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

    const theta = tangentAngle([ux, uy], Ts[bidx]);
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

    return fillGaps(dirs, isZero).map(unit);
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


export type { SleeveSide }
export {
    buildSleeveSides,
    boundaryTangents,
    boundaryPoint
}

