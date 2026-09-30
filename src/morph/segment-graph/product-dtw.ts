import type { SampledSegGraph } from './sampled-seg-graph.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';

const { abs, min, PI: π } = Math;

type ProductDtwResult_Candidate = {
    readonly startA: number;
    readonly startB: number;
    readonly endA: number;
    readonly endB: number;
    readonly totalCost: number;
    readonly shapeCost: number;
    /** measured local sway along this candidate's warp */
    readonly swayCost: number;
}

interface ProductDtwResult {
    /** raw profile-alignment cost of the winning route pair (no tails) */
    readonly shapeCost: number;
    /** objective = shapeCost + del × (material NOT covered by the routes) */
    readonly totalCost: number;
    /** measured local sway along the winning warp (NOT in the objective) */
    readonly swayCost: number;
    /** material covered by both routes, as a fraction of the total */
    readonly covered: number;
    /** chosen route endpoints: leaf vertex ids per glyph */
    readonly startA: number;
    readonly endA: number;
    readonly startB: number;
    readonly endB: number;
    /** product state count (diagnostics) */
    readonly states: number;
    /** ranked route candidates (ascending totalCost, best first) */
    readonly candidates: ProductDtwResult_Candidate[];
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

    // Companion tables ride along the DP (one per M/Ix/Iy so each carries
    // the value of ITS OWN best path; on open/extend/diagonal they copy
    // from the same predecessor table the cost came from):

    // S* = which start-leaf PAIR the state's best path began at, packed
    // (leafA << 16) | leafB - the DP explores all start pairs at once, so
    // the winning route ends are only known if the start rides along
    const SM = new Int32Array(N).fill(-1);
    const SIx = new Int32Array(N).fill(-1);
    const SIy = new Int32Array(N).fill(-1);

    // C* = material corresponded (diagonally consumed) so far - used to
    // decompose the final value back into shapeCost/totalCost
    const CM = new Float64Array(N);
    const CIx = new Float64Array(N);
    const CIy = new Float64Array(N);

    // W* = accumulated raw sway (material × |Δφ|) so far - measured only,
    // never part of the minimized value
    const WM = new Float64Array(N);
    const WIx = new Float64Array(N);
    const WIy = new Float64Array(N);

    for (const a0 of A.starts) {
        for (const b0 of B.starts) {
            const i = a0*nB + b0;
            const cov = calcMaterialA(a0) + calcMaterialB(b0);
            const cost = calcCost_(a0, b0) - del*cov;

            if (cost < M[i]) {
                M[i] = cost;
                CM[i] = cov;
                WM[i] = swayOf(a0, b0);
                SM[i] = (A.leafOf.get(a0)! << 16) | B.leafOf.get(b0)!;
            }
        }
    }

    // Process product states in ascending topo-rank sum: every move strictly
    // increases rankA + rankB, so all predecessors are settled first.
    const rankToA = A.topo;
    const rankToB = B.topo;
    const maxSum = nA + nB - 2;

    for (let s = 0; s <= maxSum; s++) {
        const rA0 = s - nB + 1 > 0
            ? s - nB + 1 : 0;

        const rA1 = s < nA - 1
            ? s : nA - 1;

        for (let rA = rA0; rA <= rA1; rA++) {
            const a = rankToA[rA];
            const b = rankToB[s - rA];
            const i = a*nB + b;

            const m = M[i];
            const ix = Ix[i];
            const iy = Iy[i];
            if (m === Infinity && ix === Infinity && iy === Infinity) { continue; }

            const best = min(m, ix, iy);
            const bestS = best === m ? SM[i] : best === ix ? SIx[i] : SIy[i];
            const bestC = best === m ? CM[i] : best === ix ? CIx[i] : CIy[i];
            const bestW = best === m ? WM[i] : best === ix ? WIx[i] : WIy[i];

            for (const aN of A.succ[a]) {
                // gap in A: consume A alone - NO coverage reward (a gap is a
                // retraction: the material keeps its drop price, else gap
                // runs launder drop costs into near-free coverage and
                // mismatched routes/pairings win)
                const openIt = m + gapOpen <= ix;
                const gx = min(m + gapOpen, ix) + extA;
                const gi = aN*nB + b;
                if (gx < Ix[gi]) {
                    Ix[gi] = gx;
                    SIx[gi] = openIt ? SM[i] : SIx[i];
                    CIx[gi] = openIt ? CM[i] : CIx[i];
                    WIx[gi] = openIt ? WM[i] : WIx[i];
                }
                // diagonal
                for (const bN of B.succ[b]) {
                    const di = aN*nB + bN;
                    const cov = calcMaterialA(aN) + calcMaterialB(bN);
                    const v = best + calcCost_(aN, bN) - del*cov;
                    if (v < M[di]) {
                        M[di] = v;
                        SM[di] = bestS;
                        CM[di] = bestC + cov;
                        WM[di] = bestW + swayOf(aN, bN);
                    }
                }
            }
            for (const bN of B.succ[b]) {
                const openIt = m + gapOpen <= iy;
                const gy = min(m + gapOpen, iy) + extB;
                const gi = a*nB + bN;
                if (gy < Iy[gi]) {
                    Iy[gi] = gy;
                    SIy[gi] = openIt ? SM[i] : SIy[i];
                    CIy[gi] = openIt ? CM[i] : CIy[i];
                    WIy[gi] = openIt ? WM[i] : WIy[i];
                }
            }
        }
    }

    let bVal = Infinity;
    let bCov = 0;
    let bSway = 0;
    let bStart = -1;
    let bEndA = -1;
    let bEndB = -1;
    
    const candidates: {
        startA: number;
        startB: number;
        endA: number;
        endB: number;
        totalCost: number;
        shapeCost: number;
        swayCost: number
    }[] = [];

    for (const aE of A.ends) {
        for (const bE of B.ends) {
            const i = aE*nB + bE;
            const m = M[i];
            const ix = Ix[i];
            const iy = Iy[i];
            const v = min(m, ix, iy);
            if (v === Infinity) { continue; }
            const cov = v === m ? CM[i] : v === ix ? CIx[i] : CIy[i];
            const sw = v === m ? WM[i] : v === ix ? WIx[i] : WIy[i];
            const start = v === m ? SM[i] : v === ix ? SIx[i] : SIy[i];
            // mean over corresponded material (cov sums matA+matB per step)
            const swayCost = cov > 0 ? sway * sw / (cov/2) : 0;
            candidates.push({
                startA: start >>> 16,
                startB: start & 0xffff,
                endA: A.leafOf.get(aE)!,
                endB: B.leafOf.get(bE)!,
                totalCost: v + del*(A.material + B.material),
                shapeCost: v + del*cov,
                swayCost
            });

            if (v < bVal) {
                bVal = v;
                bCov = cov;
                bSway = swayCost;
                bStart = start;
                bEndA = A.leafOf.get(aE)!;
                bEndB = B.leafOf.get(bE)!;
            }
        }
    }
    candidates.sort((x, y) => x.totalCost - y.totalCost);

    // v = shape − del·covered  ⇒  shape = v + del·covered;
    // total re-adds the constant drop price of ALL material.
    const shapeCost = bVal + del*bCov;
    const totalCost = bVal + del*(A.material + B.material);

    return {
        shapeCost,
        totalCost,
        swayCost: bSway,
        covered: bCov / (A.material + B.material),
        startA: bStart >>> 16,
        startB: bStart & 0xffff,
        endA: bEndA,
        endB: bEndB,
        states: N,
        candidates
    };
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

    return function(a: number, b: number): number {
        const rA = ssgA.r[a];
        const rB = ssgB.r[b];

        return (
            diagStep * (
                radius*abs(rA - rB) +
                turning*((rA + rB)/2)*abs(abs(ssgA.t[a]) - abs(ssgB.t[b])) / (2*π)
            )
        );
    }
}


export { productDtw }
export type { ProductDtwResult, ProductDtwResult_Candidate }
