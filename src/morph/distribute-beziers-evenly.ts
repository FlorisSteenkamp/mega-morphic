import type { CpNode } from "flo-mat";
import { getMatCurveToNext } from "flo-mat";
import { getTAtLength, length, fromTo, toCubic } from 'flo-bezier3';
import { sum } from "../utils/sum.js";


/** A branch resampled for morphing: cubic mat-curve beziers that correspond
 *  index-for-index (and control-point-for-control-point) with a paired branch. */
interface MorphBranch {
    cpNodes: CpNode[];
    beziers: number[][][];
}


const EPS = 1e-9;


function clamp01(t: number): number {
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** The mat-curve bezier of each cp-node along the branch. */
function branchBeziers(branch: CpNode[]): number[][][] {
    return branch.map(cpNode => getMatCurveToNext(cpNode));
}

/** Normalized (∈[0,1]) cumulative arc-length position of each segment boundary. */
function normalizedKnots(lengths: number[], total: number): number[] {
    const knots = [0];
    let cum = 0;
    for (const l of lengths) { cum += l; knots.push(cum / total); }
    knots[knots.length - 1] = 1;  // guard against floating-point drift

    return knots;
}

/** Sorted union of two knot sets, deduped within `EPS`. */
function unionKnots(a: number[], b: number[]): number[] {
    const all = [...a, ...b].sort((x, y) => x - y);
    const out: number[] = [];
    for (const v of all) {
        if (out.length === 0 || v - out[out.length - 1] > EPS) { out.push(v); }
    }

    return out;
}

/**
 * Splits a branch's beziers at the given normalized breakpoints. Since the
 * breakpoints are a superset of the branch's own knots, every interval lies
 * within a single original segment, so each output bezier is a section of one
 * original curve — elevated to cubic for uniform control-point correspondence.
 */
function splitAtBreakpoints(
        beziers: number[][][],
        lengths: number[],
        knots: number[],
        total: number,
        breakpoints: number[]): number[][][] {

    const out: number[][][] = [];
    for (let k = 0; k < breakpoints.length - 1; k++) {
        const a = breakpoints[k];
        const b = breakpoints[k + 1];
        if (b - a <= EPS) { continue; }

        // The midpoint uniquely identifies the original segment containing [a,b].
        const mid = (a + b) / 2;
        let i = 0;
        while (i < knots.length - 2 && knots[i + 1] <= mid) { i++; }

        const ps = beziers[i];
        const sA = (a - knots[i]) * total;
        const sB = (b - knots[i]) * total;
        const tA = clamp01(getTAtLength(ps, sA));
        const tB = clamp01(getTAtLength(ps, sB));

        out.push(toCubic(fromTo(ps, tA, tB)));
    }

    return out;
}

/** Piecewise-linear radius at normalized arc-length position `u`. */
function radiusAt(radii: number[], knots: number[], u: number): number {
    let i = 0;
    while (i < knots.length - 2 && knots[i + 1] <= u) { i++; }

    const span = knots[i + 1] - knots[i];
    const f = span <= EPS ? 0 : clamp01((u - knots[i]) / span);

    return radii[i]*(1 - f) + radii[i + 1]*f;
}

/**
 * Like `distributeBezierListsEvenly` but also resamples each branch's
 * maximal-disk radii (given per segment boundary) at the shared breakpoints,
 * so radii correspond index-for-index too. The shared normalized breakpoints
 * (`us`, one per segment boundary) are included in each result.
 */
function distributeBezierListsWithRadii(
        b1: number[][][],
        r1: number[],
        b2: number[][][],
        r2: number[]): [
            { beziers: number[][][]; radii: number[]; us: number[] },
            { beziers: number[][][]; radii: number[]; us: number[] }] {

    const l1 = b1.map(ps => length([0, 1], ps));
    const l2 = b2.map(ps => length([0, 1], ps));
    const L1 = sum(l1);
    const L2 = sum(l2);

    const k1 = normalizedKnots(l1, L1);
    const k2 = normalizedKnots(l2, L2);
    const breakpoints = unionKnots(k1, k2);

    return [
        {
            beziers: splitAtBreakpoints(b1, l1, k1, L1, breakpoints),
            radii: breakpoints.map(u => radiusAt(r1, k1, u)),
            us: breakpoints,
        },
        {
            beziers: splitAtBreakpoints(b2, l2, k2, L2, breakpoints),
            radii: breakpoints.map(u => radiusAt(r2, k2, u)),
            us: breakpoints,
        },
    ];
}

/**
 * Resamples two bezier lists so they correspond exactly: both are split at
 * the shared set of normalized arc-length breakpoints and elevated to cubic,
 * yielding equal bezier counts with matching control points.
 */
function distributeBezierListsEvenly(
        b1: number[][][],
        b2: number[][][]): [number[][][], number[][][]] {

    const l1 = b1.map(ps => length([0, 1], ps));
    const l2 = b2.map(ps => length([0, 1], ps));
    const L1 = sum(l1);
    const L2 = sum(l2);

    const k1 = normalizedKnots(l1, L1);
    const k2 = normalizedKnots(l2, L2);
    const breakpoints = unionKnots(k1, k2);

    return [
        splitAtBreakpoints(b1, l1, k1, L1, breakpoints),
        splitAtBreakpoints(b2, l2, k2, L2, breakpoints),
    ];
}


/**
 * Resamples two branches so their mat-curve beziers correspond exactly: both
 * are split at the shared set of normalized arc-length breakpoints and elevated
 * to cubic, yielding equal bezier counts with matching control points.
 */
function distributeBeziersEvenly(
        branch1: CpNode[],
        branch2: CpNode[]): [MorphBranch, MorphBranch] {

    const [beziers1, beziers2] = distributeBezierListsEvenly(
        branchBeziers(branch1), branchBeziers(branch2)
    );

    return [
        { cpNodes: branch1, beziers: beziers1 },
        { cpNodes: branch2, beziers: beziers2 },
    ];
}


export {
    distributeBeziersEvenly,
    distributeBezierListsEvenly,
    distributeBezierListsWithRadii
}
export type { MorphBranch }
