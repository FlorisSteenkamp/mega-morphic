import type { Circle } from 'flo-mat';
import type { SampledSegGraph } from './sampled-seg-graph.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';
import { stepCostOf } from '../match-paths/step-cost-of.js';
import { gapExtendOf } from '../match-paths/gap-extend-of.js';

const { abs, min, max, PI: π } = Math;

/** cost tolerance for a tie: symmetric shapes tie up to rounding */
const EPS = 1e-9;

/**
 * The near-tie window, as a fraction of the gap opening: paths reaching a
 * DP state within this of the best value seen there compete on value +
 * sway (`selectAlts`) - the most shape a decision may give up for
 * orientation
 */
const TIE_WINDOW = 0.05;

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
 * One way a DP state is reached (a path): where it started, its value and
 * what it accumulated on the way.
 *
 * * a state keeps the path(s) chosen by `selectAlts`: within `TIE_WINDOW`
 *   of the best value seen there, the least value + λ·`tie` - near-ties in
 *   shape are broken by orientation where they meet
 *
 * * exact ties (symmetric shapes, e.g. a cross's four tips as route starts)
 *   are all kept, so every tied start becomes a candidate and the recursion
 *   decides
 */
interface Alt {
    /** start-sample pair, packed (a0 << 16) | b0 */
    readonly start: number;
    /** the path's DP value: shape − del × covered */
    readonly v: number;
    /** material corresponded (diagonally consumed) so far - decomposes the
     *  final value back into shapeCost/totalCost */
    readonly cov: number;
    /** accumulated raw sway (material × |Δφ|/π) of the corresponded
     *  material - the measured sway */
    readonly sway: number;
    /**
     * `sway`, plus each gapped sample's share of material counted as fully
     * rotated - the tie-break's sway, so gapping rotating material never
     * lowers it
     */
    readonly tie: number;
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
 *
 * Sway does break NEAR-TIES where paths meet (`selectAlts`): within a small
 * window of the best value at a state (`TIE_WINDOW` × gap opening), the
 * path with the least value + λ × sway is kept (λ: the rate the final mean
 * charges a unit of sway). A shape tie (e.g. mirror-image serif halves as
 * route starts) is otherwise decided by rounding before sway is ever
 * measured. Gapped material counts as fully rotated in this comparison, so
 * gapping never lowers it, and the window caps the shape given up.
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

    // a gapped sample costs by its material (`gapExtendOf`)
    const extA = gapExtendOf(gapExtend, A.step, A.r);
    const extB = gapExtendOf(gapExtend, B.step, B.r);
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

    // the near-tie window, and the exchange rate turning accumulated sway
    // into score: the final sway is `sway` × the sum over half the covered
    // material - the total material stands in for the coverage, not yet
    // known where paths meet (a ceiling, so a conservative rate)
    const W = TIE_WINDOW*gapOpen;
    const total = A.material + B.material;
    const λ = total > 0 ? sway/(total/2) : 0;

    function select(alts: Alt[], best: number): Alt[] {
        return selectAlts(alts, best, W, λ);
    }

    // Gotoh DP tables, one cell per product state (a,b), each holding the
    // paths kept there (see `Alt`) and the best value ever offered there
    // (the near-tie window's reference):
    // M  = a and b MATCHED (arrived by a diagonal step)
    // Ix = in a gap in A (A advances alone, b waits)
    // Iy = in a gap in B (B advances alone, a waits)
    // Every path carries ITS OWN start/value/cov/sway. The DP explores all
    // start pairs at once, so the winning route ends are only known because
    // the start rides along.
    const BM = new Float64Array(N).fill(Infinity);
    const BIx = new Float64Array(N).fill(Infinity);
    const BIy = new Float64Array(N).fill(Infinity);
    const AM: Alt[][] = new Array(N);
    const AIx: Alt[][] = new Array(N);
    const AIy: Alt[][] = new Array(N);

    function offer(
            B_: Float64Array,
            AT: Alt[][],
            i: number,
            alts: Alt[]): void {

        for (const x of alts) { if (x.v < B_[i]) { B_[i] = x.v; } }
        AT[i] = select(AT[i] === undefined ? alts : [...AT[i], ...alts], B_[i]);
    }

    for (const a0 of A.starts) {
        for (const b0 of B.starts) {
            const i = a0*nB + b0;
            const cov = calcMaterialA(a0) + calcMaterialB(b0);
            const w = swayOf(a0, b0);
            offer(BM, AM, i, [{
                start: (a0 << 16) | b0,
                v: calcCost_(a0, b0) - del*cov,
                cov, sway: w, tie: w
            }]);
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

            const m = AM[i] ?? [];
            const ix = AIx[i] ?? [];
            const iy = AIy[i] ?? [];
            if (m.length === 0 && ix.length === 0 && iy.length === 0) {
                continue;
            }

            // the paths leaving the state on a diagonal: from any table
            const here = select(
                [...m, ...ix, ...iy], min(BM[i], BIx[i], BIy[i]));

            // gap in A: consume A alone - NO coverage reward (a gap is a
            // retraction: the material keeps its drop price, else gap runs
            // launder drop costs into near-free coverage and mismatched
            // routes/pairings win); opening from M, extending from Ix
            const opened = m.map(x => ({ ...x, v: x.v + gapOpen }));
            const fromA = select(
                [...opened, ...ix], min(BM[i] + gapOpen, BIx[i]));

            for (const aN of A.succ[a]) {
                // the gapped sample counts as fully rotated in the
                // tie-break sway (half its material: its share of a pair)
                const ext = extA(aN);
                const half = calcMaterialA(aN)/2;
                if (fromA.length > 0) {
                    offer(BIx, AIx, aN*nB + b, fromA.map(x => ({
                        ...x, v: x.v + ext, tie: x.tie + half
                    })));
                }
                // diagonal
                for (const bN of B.succ[b]) {
                    const cov = calcMaterialA(aN) + calcMaterialB(bN);
                    const c = calcCost_(aN, bN) - del*cov;
                    const w = swayOf(aN, bN);
                    offer(BM, AM, aN*nB + bN, here.map(x => ({
                        start: x.start,
                        v: x.v + c,
                        cov: x.cov + cov,
                        sway: x.sway + w,
                        tie: x.tie + w
                    })));
                }
            }

            // gap in B
            const fromB = select(
                [...opened, ...iy], min(BM[i] + gapOpen, BIy[i]));
            if (fromB.length > 0) {
                for (const bN of B.succ[b]) {
                    const ext = extB(bN);
                    const half = calcMaterialB(bN)/2;
                    offer(BIy, AIy, a*nB + bN, fromB.map(x => ({
                        ...x, v: x.v + ext, tie: x.tie + half
                    })));
                }
            }
        }
    }

    const candidates: ProductDtwResult_Candidate[] = [];

    for (const aE of A.ends) {
        for (const bE of B.ends) {
            const i = aE*nB + bE;
            const best = min(BM[i], BIx[i], BIy[i]);
            if (best === Infinity) { continue; }
            const endA = A.leafOf.get(aE)!;
            const endB = B.leafOf.get(bE)!;

            // one candidate per kept path (start) at this end pair;
            // v = shape − del·covered  ⇒  shape = v + del·covered;
            // total re-adds the constant drop price of ALL material.
            const alts = select(
                [...(AM[i] ?? []), ...(AIx[i] ?? []), ...(AIy[i] ?? [])],
                best);
            for (const alt of alts) {
                candidates.push({
                    startA: A.leafOf.get(alt.start >>> 16)!,
                    startB: B.leafOf.get(alt.start & 0xffff)!,
                    endA,
                    endB,
                    totalCost: alt.v + del*total,
                    shapeCost: alt.v + del*alt.cov,
                    swayCost: swayCostOf(alt),
                    covered: alt.cov / total
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
 * Returns the paths to keep among those reaching a state (`alts`):
 *
 * * only paths within `W` of `best` (the best value ever offered there)
 *   compete - the window is always measured against the best, never
 *   against the path kept, so tie-breaks can't drift the value away
 *
 * * among those, the least value + λ × tie-break sway wins - near-ties in
 *   shape go to the path whose material turns less (e.g. the serif half
 *   pointing the same way); exact ties (within `EPS`) are all kept
 *
 * * a start reached more than one way keeps its best path
 *
 * @param alts the paths
 * @param best the best value ever offered at the state
 * @param W the near-tie window
 * @param λ the exchange rate of tie-break sway into value
 */
function selectAlts(
        alts: Alt[],
        best: number,
        W: number,
        λ: number): Alt[] {

    const keyOf = (x: Alt) => x.v + λ*x.tie;

    let kMin = Infinity;
    for (const x of alts) {
        if (x.v <= best + W && keyOf(x) < kMin) { kMin = keyOf(x); }
    }

    const out: Alt[] = [];
    for (const x of alts) {
        if (x.v > best + W || keyOf(x) > kMin + EPS) { continue; }

        const k = out.findIndex(y => y.start === x.start);
        if (k < 0) { out.push(x); }
        else if (keyOf(x) < keyOf(out[k])) { out[k] = x; }
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
