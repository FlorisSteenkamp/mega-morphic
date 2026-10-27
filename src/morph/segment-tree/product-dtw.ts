import type { Circle } from 'flo-mat';
import type { SampledSegGraph } from './sampled-seg-graph.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';
import { stepCostOf } from '../match-paths/step-cost-of.js';
import { gapExtendOf } from '../match-paths/gap-extend-of.js';

const { abs, min, max, floor, PI: π } = Math;

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
 * sharing a prefix share DP states), with the step cost of `stepCostOf`
 * (radius + radius-weighted turning, integrated over normalized arc).
 *
 * Off-route material is priced like the matcher's drops:
 * each DIAGONALLY consumed sample earns back `del` × its local material
 * (≈ salience fraction), so routes compete on alignment quality MINUS
 * corresponded material - without this, two tiny near-identical pathlets win
 * trivially. Gap-consumed material earns NOTHING (it retracts like a drop;
 * the gap price comes on top). Score-only: no tails, no pooled-children
 * terms.
 *
 * @param sway LOCAL sway weight (the trunk's: weights.sway × glyph-pair
 * anisotropy; a child pair's: weights.childSway).
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

    // one start pair (a pinned start): every state keeps at most one path
    if (A.starts.length === 1 && B.starts.length === 1) {
        return productDtwSingle(A, B, weights, sway);
    }

    return productDtwGeneral(A, B, weights, sway);
}


/**
 * `productDtw` over any start pairs: every path carries its own start (see
 * `Alt`).
 */
function productDtwGeneral(
        A: SampledSegGraph,
        B: SampledSegGraph,
        weights: PathCostWeights,
        sway: number): ProductDtwResult {

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


/** One Gotoh table of `productDtwSingle`: per state its (single) kept path. */
interface SingleTable {
    /** the best value ever offered at the state (the near-tie reference) */
    readonly best: Float64Array;
    /** whether the state keeps a path */
    readonly has: Uint8Array;
    /** the kept path's value, coverage, sway and tie-break sway (see `Alt`) */
    readonly v: Float64Array;
    readonly cov: Float64Array;
    readonly sw: Float64Array;
    readonly tie: Float64Array;
    /**
     * the kept path's previous state, `state × 3 + table` (`0` M, `1` Ix,
     * `2` Iy), `-1` at the start - for `traceSingleDtw`
     */
    readonly from: Int32Array;
}


/**
 * **Diagnostics only** - one state of a `productDtwSingle` path: sample `a`
 * of A and `b` of B, reached by a diagonal (`state` 0), by A advancing
 * alone (`1`, a gap in B) or by B advancing alone (`2`); `cost` is the
 * diagonal's step cost (`0` for a gap).
 */
interface DtwTraceStep {
    readonly a: number;
    readonly b: number;
    readonly state: 0 | 1 | 2;
    readonly cost: number;
}


/** **Diagnostics only** - a `productDtwSingle` path and its DP's values. */
interface DtwTrace {
    /** the kept path, start → end (`traceSingleDtw`) */
    readonly steps: DtwTraceStep[];
    /**
     * the DP's value at state `(a, b)` (samples of A and B): that of the
     * best path kept there (shape − del × covered, what the DP minimizes) -
     * `Infinity` where none reaches it
     *
     * * holds the DP's tables: read what is needed, then let it go
     */
    readonly valueAt: (a: number, b: number) => number;
}


/**
 * `productDtw` with a single start pair (both graphs sampled from a pinned
 * start) - the same DP, results identical, without its per-path objects.
 *
 * * `selectAlts` keeps at most one path per start, so with one start pair
 *   every table cell holds at most one path: it is kept as numbers in typed
 *   arrays (`SingleTable`), and the selection among the few paths meeting
 *   at a state (`pick`) follows `selectAlts` exactly - same window, same
 *   tie-break key, same order (the first of equal keys is kept)
 *
 * * the general DP allocates arrays and path objects at every step - with
 *   the pinned-start DTWs of route pairs and child pairs run hundreds of
 *   times per match, that was most of the matching time
 */
function productDtwSingle(
        A: SampledSegGraph,
        B: SampledSegGraph,
        weights: PathCostWeights,
        sway: number): ProductDtwResult {

    return runSingle(A, B, weights, sway).result;
}


/**
 * **Diagnostics only** - Returns the path `productDtwSingle` keeps from
 * the start pair to the end pair `endA`, `endB` (the route ends'
 * vertices), start → end, with the DP's values (`DtwTrace`) - `undefined`
 * if no path reaches it.
 *
 * * the very DP the matcher runs (same samples, objective and tie-breaks),
 *   so the path is the one its costs were measured along
 */
function traceSingleDtw(
        A: SampledSegGraph,
        B: SampledSegGraph,
        weights: PathCostWeights,
        sway: number,
        endA: Circle,
        endB: Circle): DtwTrace | undefined {

    const { traceTo, valueAt } = runSingle(A, B, weights, sway);
    const steps = traceTo(endA, endB);

    return steps === undefined ? undefined : { steps, valueAt };
}


/**
 * The DP of `productDtwSingle`: its result, and the traceback of its kept
 * paths (its tables live as long as `traceTo` does).
 */
function runSingle(
        A: SampledSegGraph,
        B: SampledSegGraph,
        weights: PathCostWeights,
        sway: number) {

    const { radius, turning, gapOpen, gapExtend, del } = weights;

    const nA = A.r.length;
    const nB = B.r.length;
    const N = nA * nB;

    const extA = gapExtendOf(gapExtend, A.step, A.r);
    const extB = gapExtendOf(gapExtend, B.step, B.r);
    const diagStep = (A.step + B.step) / 2;

    const calcMaterialA = getMaterial(A);
    const calcMaterialB = getMaterial(B);
    const calcCost_ = calcCost(A, B, diagStep, radius, turning);

    function swayOf(a: number, b: number): number {
        return (
            (calcMaterialA(a) + calcMaterialB(b))/2) * abs(wrapAngle(A.φ[a] - B.φ[b])
        ) / π;
    }

    const W = TIE_WINDOW*gapOpen;
    const total = A.material + B.material;
    const λ = total > 0 ? sway/(total/2) : 0;

    const M = createSingleTable(N);
    const Ix = createSingleTable(N);
    const Iy = createSingleTable(N);
    const tables = [M, Ix, Iy];

    // the paths meeting at a state, in `selectAlts`' order (at most 3),
    // each with its back-pointer (see `SingleTable`'s `from`)
    const sv = new Float64Array(3);
    const sc = new Float64Array(3);
    const ss = new Float64Array(3);
    const st = new Float64Array(3);
    const sf = new Int32Array(3);
    let sn = 0;

    function push(
            v: number,
            cov: number,
            sw: number,
            tie: number,
            f: number): void {

        sv[sn] = v; sc[sn] = cov; ss[sn] = sw; st[sn] = tie; sf[sn] = f;
        sn++;
    }

    /**
     * pushes table `t`'s path at `i`, if any, its value raised by `dv` -
     * continuing from there (its back-pointer is that state)
     */
    function pushFrom(t: 0 | 1 | 2, i: number, dv: number): void {
        const T = tables[t];
        if (T.has[i] === 1) {
            push(T.v[i] + dv, T.cov[i], T.sw[i], T.tie[i], i*3 + t);
        }
    }

    /** `selectAlts` over the pushed paths: the kept one's index, or -1 */
    function pick(best: number): number {
        let kMin = Infinity;
        for (let k = 0; k < sn; k++) {
            const key = sv[k] + λ*st[k];
            if (sv[k] <= best + W && key < kMin) { kMin = key; }
        }

        let out = -1;
        for (let k = 0; k < sn; k++) {
            const key = sv[k] + λ*st[k];
            if (sv[k] > best + W || key > kMin + EPS) { continue; }
            if (out < 0 || key < sv[out] + λ*st[out]) { out = k; }
        }

        return out;
    }

    function offer(
            T: SingleTable,
            i: number,
            v: number,
            cov: number,
            sw: number,
            tie: number,
            f: number): void {

        if (v < T.best[i]) { T.best[i] = v; }

        sn = 0;
        if (T.has[i] === 1) {
            push(T.v[i], T.cov[i], T.sw[i], T.tie[i], T.from[i]);
        }
        push(v, cov, sw, tie, f);
        const k = pick(T.best[i]);
        if (k < 0) { T.has[i] = 0; return; }

        T.has[i] = 1;
        T.v[i] = sv[k]; T.cov[i] = sc[k]; T.sw[i] = ss[k]; T.tie[i] = st[k];
        T.from[i] = sf[k];
    }

    const a0 = A.starts[0];
    const b0 = B.starts[0];
    {
        const cov = calcMaterialA(a0) + calcMaterialB(b0);
        const w = swayOf(a0, b0);
        offer(M, a0*nB + b0, calcCost_(a0, b0) - del*cov, cov, w, w, -1);
    }

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

            if (M.has[i] === 0 && Ix.has[i] === 0 && Iy.has[i] === 0) {
                continue;
            }

            // the path leaving on a diagonal
            sn = 0;
            pushFrom(0, i, 0); pushFrom(1, i, 0); pushFrom(2, i, 0);
            const kh = pick(min(M.best[i], Ix.best[i], Iy.best[i]));
            const hasH = kh >= 0;
            const hv = sv[kh], hc = sc[kh], hs = ss[kh], ht = st[kh];
            const hf = sf[kh];

            // gap in A: opened from M, extended from Ix
            sn = 0;
            pushFrom(0, i, gapOpen); pushFrom(1, i, 0);
            const ka = pick(min(M.best[i] + gapOpen, Ix.best[i]));
            const hasA = ka >= 0;
            const av = sv[ka], ac = sc[ka], as = ss[ka], at = st[ka];
            const af = sf[ka];

            for (const aN of A.succ[a]) {
                const ext = extA(aN);
                const half = calcMaterialA(aN)/2;
                if (hasA) {
                    offer(Ix, aN*nB + b, av + ext, ac, as, at + half, af);
                }

                if (!hasH) { continue; }
                for (const bN of B.succ[b]) {
                    const cov = calcMaterialA(aN) + calcMaterialB(bN);
                    const c = calcCost_(aN, bN) - del*cov;
                    const w = swayOf(aN, bN);
                    offer(M, aN*nB + bN, hv + c, hc + cov, hs + w, ht + w, hf);
                }
            }

            // gap in B: opened from M, extended from Iy
            sn = 0;
            pushFrom(0, i, gapOpen); pushFrom(2, i, 0);
            const kb = pick(min(M.best[i] + gapOpen, Iy.best[i]));
            if (kb < 0) { continue; }
            const bv = sv[kb], bc = sc[kb], bs = ss[kb], bt = st[kb];
            const bf = sf[kb];

            for (const bN of B.succ[b]) {
                const ext = extB(bN);
                const half = calcMaterialB(bN)/2;
                offer(Iy, a*nB + bN, bv + ext, bc, bs, bt + half, bf);
            }
        }
    }

    const candidates: ProductDtwResult_Candidate[] = [];

    const startA = A.leafOf.get(a0)!;
    const startB = B.leafOf.get(b0)!;
    for (const aE of A.ends) {
        for (const bE of B.ends) {
            const i = aE*nB + bE;
            const best = min(M.best[i], Ix.best[i], Iy.best[i]);
            if (best === Infinity) { continue; }

            sn = 0;
            pushFrom(0, i, 0); pushFrom(1, i, 0); pushFrom(2, i, 0);
            const k = pick(best);
            if (k < 0) { continue; }

            const v = sv[k];
            const cov = sc[k];
            candidates.push({
                startA,
                startB,
                endA: A.leafOf.get(aE)!,
                endB: B.leafOf.get(bE)!,
                totalCost: v + del*total,
                shapeCost: v + del*cov,
                swayCost: cov > 0 ? sway * ss[k] / (cov/2) : 0,
                covered: cov / total
            });
        }
    }
    candidates.sort((x, y) => x.totalCost - y.totalCost);

    const result: ProductDtwResult = { ...candidates[0], states: N, candidates };

    return { result, traceTo, valueAt };


    /**
     * the value (shape − del × covered) of the best path kept at state
     * `(a, b)` - `Infinity` where none reaches it
     */
    function valueAt(
            a: number,
            b: number): number {

        const i = a*nB + b;
        let v = Infinity;
        for (const T of tables) {
            if (T.has[i] === 1 && T.v[i] < v) { v = T.v[i]; }
        }

        return v;
    }


    /** the kept path to the end pair (`traceSingleDtw`) */
    function traceTo(
            endA: Circle,
            endB: Circle): DtwTraceStep[] | undefined {

        const aE = A.ends.find(e => A.leafOf.get(e) === endA);
        const bE = B.ends.find(e => B.leafOf.get(e) === endB);
        if (aE === undefined || bE === undefined) { return undefined; }

        const i = aE*nB + bE;
        sn = 0;
        pushFrom(0, i, 0); pushFrom(1, i, 0); pushFrom(2, i, 0);
        const k = pick(min(M.best[i], Ix.best[i], Iy.best[i]));
        if (k < 0) { return undefined; }

        const steps: DtwTraceStep[] = [];
        for (let f = sf[k]; f >= 0; ) {
            const j = floor(f/3);
            const t = (f - 3*j) as 0 | 1 | 2;
            const a = floor(j/nB);
            const b = j - a*nB;
            steps.push({ a, b, state: t, cost: t === 0 ? calcCost_(a, b) : 0 });
            f = tables[t].from[j];
        }

        return steps.reverse();
    }
}


/** Returns an empty `SingleTable` of `n` states. */
function createSingleTable(
        n: number): SingleTable {

    return {
        best: new Float64Array(n).fill(Infinity),
        has: new Uint8Array(n),
        v: new Float64Array(n),
        cov: new Float64Array(n),
        sw: new Float64Array(n),
        tie: new Float64Array(n),
        from: new Int32Array(n)
    };
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


export { productDtw, traceSingleDtw }
export type { ProductDtwResult, ProductDtwResult_Candidate, DtwTraceStep, DtwTrace }
