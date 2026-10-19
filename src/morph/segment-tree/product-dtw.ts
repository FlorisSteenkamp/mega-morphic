import type { Circle } from 'flo-mat';
import type { SampledSegGraph } from './sampled-seg-graph.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';
import { stepCostOf } from '../match-paths/step-cost-of.js';

const { abs, min, max, PI: π } = Math;

/** cost tolerance for a tie: symmetric shapes tie up to rounding */
const EPS = 1e-9;

type ProductDtwResult_Candidate = {
    readonly startA: Circle;
    readonly startB: Circle;
    readonly endA: Circle;
    readonly endB: Circle;
    readonly totalCost: number;
    readonly shapeCost: number;
    /** measured local sway along this candidate's warp */
    readonly swayCost: number;
    /**
     * **diagnostics only** - material covered by both routes, as a fraction
     * of the total
     */
    readonly covered: number;
}

/**
 * The product DTW's outcome: the winning route pair plus all ranked
 * candidates.
 *
 * * the matcher only reads `totalCost`, `swayCost` and `candidates`
 * * every field marked **diagnostics only** exists for inspection (e.g.
 *   `product-dtw-diagnostic.spec.ts`) and is never read by the matcher
 */
interface ProductDtwResult {
    /** objective = shapeCost + del × (material NOT covered by the routes) */
    readonly totalCost: number;
    /** measured local sway along the winning warp (NOT in the objective) */
    readonly swayCost: number;
    /** ranked route candidates (ascending totalCost, best first) */
    readonly candidates: ProductDtwResult_Candidate[];

    //-----------------------------------
    // DIAGNOSTICS ONLY FIELDS FOLLOW...
    //-----------------------------------

    /**
     * **diagnostics only** - raw profile-alignment cost of the winning route
     * pair (no tails)
     */
    readonly shapeCost: number;
    /**
     * **diagnostics only** - material covered by both routes, as a fraction
     * of the total
     */
    readonly covered: number;
    /**
     * **diagnostics only** - the winning route endpoints: leaf vertices per
     * glyph (the matcher takes routes from `candidates`)
     */
    readonly startA: Circle;
    readonly endA: Circle;
    readonly startB: Circle;
    readonly endB: Circle;
    /** **diagnostics only** - product state count */
    readonly states: number;
}


/**
 * One way a DP state is reached at its best cost: where the path started
 * and what it accumulated on the way. A state keeps EVERY alternative that
 * ties for its best cost (symmetric shapes tie exactly, e.g. a cross's four
 * tips as route starts), so no start is discarded by an arbitrary rule -
 * every tied start becomes a candidate and the recursion decides.
 */
interface Alt {
    /** start-sample pair, packed (a0 << 16) | b0 */
    readonly start: number;
    /** material corresponded (diagonally consumed) so far - decomposes the
     *  final value back into shapeCost/totalCost */
    readonly cov: number;
    /** accumulated raw sway (material × |Δφ|) - measured only, never part
     *  of the minimized value */
    readonly sway: number;
}


/**
 * Gotoh affine-gap DTW over the PRODUCT of two sampled segment DAGs: one DP
 * covers every leaf-to-leaf path pair of both glyphs simultaneously (paths
 * sharing a prefix share DP states), using the same step-cost structure as
 * `alignProfiles` (radius + radius-weighted turning, integrated over
 * normalized arc).
 *
 * Off-route material is priced like the matcher's drops:
 * each DIAGONALLY consumed sample earns back `del` × its local material
 * (≈ salience fraction), so routes compete on alignment quality MINUS
 * corresponded material - without this, two tiny near-identical pathlets win
 * trivially. Gap-consumed material earns NOTHING (it retracts like a drop;
 * the gap price comes on top). Score-only: no tails, no pooled-children
 * terms.
 *
 * @param sway LOCAL sway weight (weights.sway × glyph-pair anisotropy).
 * MEASURED along the optimal intrinsic warp and reported as `swayCost` =
 * sway × material-weighted MEAN (over corresponded samples) of
 * |wrap(φA−φB)|/π (φ = absolute travel direction): how much corresponded
 * material would locally ROTATE. The MEAN keeps the scale warp-gap-
 * independent. It deliberately does NOT enter the DP objective, else the
 * warp dodges it (gap-skipping rotating material / pairing same-direction
 * strokes inside a flipped route) and flipped candidates look cheap.
 * Callers add `swayCost` to selection and relabel prices. (Global
 * route-mean angle diffs are NOT equivalent: stroke means can cancel or
 * mis-penalize locally-clean pairings, e.g. M→N.)
 */
function productDtw(
        A: SampledSegGraph,
        B: SampledSegGraph,
        weights: PathCostWeights,
        sway = 0): ProductDtwResult {

    const { radius, turning, gapOpen, gapExtend, del } = weights;

    const nA = A.r.length;
    const nB = B.r.length;
    const N = nA * nB;

    const extA = gapExtend * A.step;
    const extB = gapExtend * B.step;
    const diagStep = (A.step + B.step) / 2;

    // local material of one sample (≈ its salience fraction: 2r̂ dŝ)
    const calcMaterialA = getMaterial(A);
    const calcMaterialB = getMaterial(B);
    const calcCost_ = calcCost(A, B, diagStep, radius, turning);

    // raw sway contribution of one corresponded sample: material × local
    // orientation diff; mean taken at extraction
    function swayOf(a: number, b: number): number {
        return (
            (calcMaterialA(a) + calcMaterialB(b))/2) * abs(wrapAngle(A.φ[a] - B.φ[b])
        ) / π;
    }

    // Gotoh DP tables, one cell per product state (a,b):
    // M  = best cost with a and b MATCHED (arrived by a diagonal step)
    // Ix = best cost while in a gap in A (A advances alone, b waits)
    // Iy = best cost while in a gap in B (B advances alone, a waits)
    const M = new Float64Array(N).fill(Infinity);
    const Ix = new Float64Array(N).fill(Infinity);
    const Iy = new Float64Array(N).fill(Infinity);

    // ...and per cell the alternatives attaining that cost (see `Alt`) -
    // one table each, so every path carries ITS OWN start/cov/sway; on
    // open/extend/diagonal they come from the predecessor table(s) the
    // cost came from. The DP explores all start pairs at once, so the
    // winning route ends are only known because the start rides along.
    const AM: (Alt[] | undefined)[] = new Array(N);
    const AIx: (Alt[] | undefined)[] = new Array(N);
    const AIy: (Alt[] | undefined)[] = new Array(N);

    for (const a0 of A.starts) {
        for (const b0 of B.starts) {
            const i = a0*nB + b0;
            const cov = calcMaterialA(a0) + calcMaterialB(b0);
            const cost = calcCost_(a0, b0) - del*cov;
            settle(M, AM, i, cost, [
                { start: (a0 << 16) | b0, cov, sway: swayOf(a0, b0) }
            ]);
        }
    }

    // Process product states in ascending topo-rank sum: every move strictly
    // increases rankA + rankB, so all predecessors are settled first.
    const rankToA = A.topo;
    const rankToB = B.topo;
    const maxSum = nA + nB - 2;

    for (let s = 0; s <= maxSum; s++) {
        const rA0 = max(0, s - nB + 1);
        const rA1 = min(s, nA - 1);

        for (let rA = rA0; rA <= rA1; rA++) {
            const a = rankToA[rA];
            const b = rankToB[s - rA];
            const i = a*nB + b;

            const m = M[i];
            const ix = Ix[i];
            const iy = Iy[i];
            if (m === Infinity && ix === Infinity && iy === Infinity) { continue; }

            const best = min(m, ix, iy);
            const bestAlts = altsWithin(best, [m, ix, iy], [AM[i], AIx[i], AIy[i]]);

            const open = m + gapOpen;

            // gap in A: consume A alone - NO coverage reward (a gap is a
            // retraction: the material keeps its drop price, else gap runs
            // launder drop costs into near-free coverage and mismatched
            // routes/pairings win)
            const gA = min(open, ix);
            const altsA = gA === Infinity
                ? undefined
                : altsWithin(gA, [open, ix], [AM[i], AIx[i]]);

            for (const aN of A.succ[a]) {
                if (altsA !== undefined) {
                    settle(Ix, AIx, aN*nB + b, gA + extA, altsA);
                }
                // diagonal
                for (const bN of B.succ[b]) {
                    const cov = calcMaterialA(aN) + calcMaterialB(bN);
                    const v = best + calcCost_(aN, bN) - del*cov;
                    const w = swayOf(aN, bN);
                    settle(M, AM, aN*nB + bN, v, bestAlts.map(x => ({
                        start: x.start, cov: x.cov + cov, sway: x.sway + w
                    })));
                }
            }
            // gap in B
            const gB = min(open, iy);
            if (gB !== Infinity) {
                const altsB = altsWithin(gB, [open, iy], [AM[i], AIy[i]]);
                for (const bN of B.succ[b]) {
                    settle(Iy, AIy, a*nB + bN, gB + extB, altsB);
                }
            }
        }
    }

    const candidates: ProductDtwResult_Candidate[] = [];

    for (const aE of A.ends) {
        for (const bE of B.ends) {
            const i = aE*nB + bE;
            const v = min(M[i], Ix[i], Iy[i]);
            if (v === Infinity) { continue; }
            const endA = A.leafOf.get(aE)!;
            const endB = B.leafOf.get(bE)!;

            // one candidate per tied alternative (start) at this end pair;
            // v = shape − del·covered  ⇒  shape = v + del·covered;
            // total re-adds the constant drop price of ALL material.
            for (const alt of altsWithin(v, [M[i], Ix[i], Iy[i]], [AM[i], AIx[i], AIy[i]])) {
                candidates.push({
                    startA: A.leafOf.get(alt.start >>> 16)!,
                    startB: B.leafOf.get(alt.start & 0xffff)!,
                    endA,
                    endB,
                    totalCost: v + del*(A.material + B.material),
                    shapeCost: v + del*alt.cov,
                    swayCost: swayCostOf(alt),
                    covered: alt.cov / (A.material + B.material)
                });
            }
        }
    }
    // stable: equal costs keep push order, so the winner is the first
    // candidate of minimal cost
    candidates.sort((x, y) => x.totalCost - y.totalCost);

    return { ...candidates[0], states: N, candidates };


    /** mean over corresponded material (cov sums matA+matB per step) */
    function swayCostOf(alt: Alt): number {
        return alt.cov > 0 ? sway * alt.sway / (alt.cov/2) : 0;
    }
}


/**
 * Records that state `i` of table `T` is reached at cost `v` by `alts`:
 * a strictly better cost replaces the cell, a tie (within `EPS`) keeps
 * both sides' alternatives.
 */
function settle(
        T: Float64Array,
        AT: (Alt[] | undefined)[],
        i: number,
        v: number,
        alts: Alt[]): void {

    const cur = T[i];
    if (v < cur - EPS) {
        T[i] = v;
        AT[i] = alts;
    } else if (v <= cur + EPS) {
        AT[i] = mergeAlts(AT[i]!, alts);
    }
}


/** The alternatives of every source whose value ties with `best`. */
function altsWithin(
        best: number,
        values: number[],
        alts: (Alt[] | undefined)[]): Alt[] {

    let out: Alt[] | undefined;
    for (let k = 0; k < values.length; k++) {
        if (values[k] > best + EPS) { continue; }
        out = out === undefined ? alts[k]! : mergeAlts(out, alts[k]!);
    }

    return out!;
}


/** Union by start; a start reached two ways keeps the lower sway. */
function mergeAlts(a: Alt[], b: Alt[]): Alt[] {
    const out = a.slice();
    for (const x of b) {
        const k = out.findIndex(y => y.start === x.start);
        if (k < 0) { out.push(x); }
        else if (x.sway < out[k].sway) { out[k] = x; }
    }

    return out;
}


function getMaterial(
        ssg: SampledSegGraph) {

    return function (a: number): number {
        return 2*ssg.r[a]*ssg.step;
    }
}


function calcCost(
        ssgA: SampledSegGraph,
        ssgB: SampledSegGraph,
        diagStep: number,
        radius: number,
        turning: number) {

    const stepCost = stepCostOf(diagStep, radius, turning);

    return function(a: number, b: number): number {
        return stepCost(ssgA.r[a], ssgB.r[b], ssgA.t[a], ssgB.t[b]);
    }
}


export { productDtw }
export type { ProductDtwResult, ProductDtwResult_Candidate }
