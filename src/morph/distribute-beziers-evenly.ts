import { sum } from "../utils/sum.js";
import { cubicSection } from './fs/cubic-section.js';
import { length$ } from "./fs/length.js";
import { calcSkelCumKnots } from './fs/skeleton-knots.js';
import { knotIdxAt } from './fs/knot-idx-at.js';


const EPS = 1e-9;


/** Sorted union of two knot sets, deduped within `EPS`. */
function unionKnots(
        a: number[],
        b: number[]): number[] {

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
        knots: number[],
        total: number,
        breakpoints: number[]): number[][][] {

    const out: number[][][] = [];
    for (let k = 0; k < breakpoints.length - 1; k++) {
        const a = breakpoints[k];
        const b = breakpoints[k + 1];
        if (b - a <= EPS) { continue; }

        // The midpoint uniquely identifies the original segment containing [a,b].
        const i = knotIdxAt(knots, (a + b) / 2);

        const ps = beziers[i];
        const sA = (a - knots[i]) * total;
        const sB = (b - knots[i]) * total;
        out.push(cubicSection(ps, sA, sB));
    }

    return out;
}


/**
 * Resamples two bezier lists so they correspond exactly: both are split at
 * the shared set of normalized arc-length breakpoints and elevated to cubic,
 * yielding equal bezier counts with matching control points.
 */
function distributeBezierListsEvenly(
        b1: number[][][],
        b2: number[][][]): [number[][][], number[][][]] {

    const L1 = sum(b1.map(length$));
    const L2 = sum(b2.map(length$));

    const k1 = calcSkelCumKnots(b1);
    const k2 = calcSkelCumKnots(b2);
    const breakpoints = unionKnots(k1, k2);

    return [
        splitAtBreakpoints(b1, k1, L1, breakpoints),
        splitAtBreakpoints(b2, k2, L2, breakpoints),
    ];
}


export { distributeBezierListsEvenly }
