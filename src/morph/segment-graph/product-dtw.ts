import type { SampledSegGraph } from './sample-seg-graph.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';

const { abs, min, PI: π } = Math;


interface ProductDtwResult {
    /** raw profile-alignment cost of the winning route pair (no tails) */
    readonly shapeCost: number;
    /** objective = shapeCost + del × (material NOT covered by the routes) */
    readonly totalCost: number;
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
    readonly candidates: {
        readonly startA: number;
        readonly startB: number;
        readonly endA: number;
        readonly endB: number;
        readonly totalCost: number;
        readonly shapeCost: number;
    }[];
}

/** end-state candidates kept for recursion-aware route re-ranking */
const MAX_CANDIDATES = 8;


/**
 * Gotoh affine-gap DTW over the PRODUCT of two sampled segment DAGs: one DP
 * covers every leaf-to-leaf path pair of both glyphs simultaneously (paths
 * sharing a prefix share DP states), using the same step-cost structure as
 * `alignProfiles` (radius + radius-weighted turning, integrated over
 * normalized arc). Off-route material is priced like the matcher's drops:
 * each consumed sample earns back `del` × its local material (≈ salience
 * fraction), so routes compete on alignment quality MINUS covered material -
 * without this, two tiny near-identical pathlets win trivially. Score-only:
 * no tails, no pooled-children terms.
 */
function productDtw(
        A: SampledSegGraph,
        B: SampledSegGraph,
        weights: PathCostWeights): ProductDtwResult {

    const { radius, turning, gapOpen, gapExtend, del } = weights;
    const nA = A.r.length;
    const nB = B.r.length;
    const N = nA * nB;

    const extA = gapExtend * A.step;
    const extB = gapExtend * B.step;
    const diagStep = (A.step + B.step) / 2;

    // local material of one sample (≈ its salience fraction: 2r̂ dŝ)
    const matA = (a: number): number => 2*A.r[a]*A.step;
    const matB = (b: number): number => 2*B.r[b]*B.step;

    const cost = (a: number, b: number): number => {
        const rA = A.r[a];
        const rB = B.r[b];
        return diagStep * (radius*abs(rA - rB)
            + turning*((rA + rB)/2)*abs(abs(A.t[a]) - abs(B.t[b])) / (2*π));
    };

    const INF = Infinity;
    const M = new Float64Array(N).fill(INF);
    const Ix = new Float64Array(N).fill(INF);
    const Iy = new Float64Array(N).fill(INF);
    // start leaf pair per state, packed (leafA << 16) | leafB
    const SM = new Int32Array(N).fill(-1);
    const SIx = new Int32Array(N).fill(-1);
    const SIy = new Int32Array(N).fill(-1);
    // covered material along the state's best path (for score decomposition)
    const CM = new Float64Array(N);
    const CIx = new Float64Array(N);
    const CIy = new Float64Array(N);

    for (const a0 of A.starts) {
        for (const b0 of B.starts) {
            const i = a0*nB + b0;
            const cov = matA(a0) + matB(b0);
            const c = cost(a0, b0) - del*cov;
            if (c < M[i]) {
                M[i] = c;
                CM[i] = cov;
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
        const rA0 = s - nB + 1 > 0 ? s - nB + 1 : 0;
        const rA1 = s < nA - 1 ? s : nA - 1;
        for (let rA = rA0; rA <= rA1; rA++) {
            const a = rankToA[rA];
            const b = rankToB[s - rA];
            const i = a*nB + b;

            const m = M[i];
            const ix = Ix[i];
            const iy = Iy[i];
            if (m === INF && ix === INF && iy === INF) { continue; }

            const best = min(m, ix, iy);
            const bestS = best === m ? SM[i] : best === ix ? SIx[i] : SIy[i];
            const bestC = best === m ? CM[i] : best === ix ? CIx[i] : CIy[i];

            for (const aN of A.succ[a]) {
                // gap in A: consume A alone (still covered material)
                const openIt = m + gapOpen <= ix;
                const gx = min(m + gapOpen, ix) + extA - del*matA(aN);
                const gi = aN*nB + b;
                if (gx < Ix[gi]) {
                    Ix[gi] = gx;
                    SIx[gi] = openIt ? SM[i] : SIx[i];
                    CIx[gi] = (openIt ? CM[i] : CIx[i]) + matA(aN);
                }
                // diagonal
                for (const bN of B.succ[b]) {
                    const di = aN*nB + bN;
                    const cov = matA(aN) + matB(bN);
                    const v = best + cost(aN, bN) - del*cov;
                    if (v < M[di]) {
                        M[di] = v;
                        SM[di] = bestS;
                        CM[di] = bestC + cov;
                    }
                }
            }
            for (const bN of B.succ[b]) {
                const openIt = m + gapOpen <= iy;
                const gy = min(m + gapOpen, iy) + extB - del*matB(bN);
                const gi = a*nB + bN;
                if (gy < Iy[gi]) {
                    Iy[gi] = gy;
                    SIy[gi] = openIt ? SM[i] : SIy[i];
                    CIy[gi] = (openIt ? CM[i] : CIy[i]) + matB(bN);
                }
            }
        }
    }

    let bVal = INF;
    let bCov = 0;
    let bStart = -1;
    let bEndA = -1;
    let bEndB = -1;
    const candidates: { startA: number; startB: number; endA: number;
        endB: number; totalCost: number; shapeCost: number }[] = [];
    for (const aE of A.ends) {
        for (const bE of B.ends) {
            const i = aE*nB + bE;
            const m = M[i];
            const ix = Ix[i];
            const iy = Iy[i];
            const v = min(m, ix, iy);
            if (v === INF) { continue; }
            const cov = v === m ? CM[i] : v === ix ? CIx[i] : CIy[i];
            const start = v === m ? SM[i] : v === ix ? SIx[i] : SIy[i];
            candidates.push({
                startA: start >>> 16,
                startB: start & 0xffff,
                endA: A.leafOf.get(aE)!,
                endB: B.leafOf.get(bE)!,
                totalCost: v + del*(A.material + B.material),
                shapeCost: v + del*cov
            });
            if (v < bVal) {
                bVal = v;
                bCov = cov;
                bStart = start;
                bEndA = A.leafOf.get(aE)!;
                bEndB = B.leafOf.get(bE)!;
            }
        }
    }
    candidates.sort((x, y) => x.totalCost - y.totalCost);
    candidates.length = min(candidates.length, MAX_CANDIDATES);

    // v = shape − del·covered  ⇒  shape = v + del·covered;
    // total re-adds the constant drop price of ALL material.
    const shapeCost = bVal + del*bCov;
    const totalCost = bVal + del*(A.material + B.material);

    return {
        shapeCost,
        totalCost,
        covered: bCov / (A.material + B.material),
        startA: bStart >>> 16,
        startB: bStart & 0xffff,
        endA: bEndA,
        endB: bEndB,
        states: N,
        candidates
    };
}


export { productDtw }
export type { ProductDtwResult }
