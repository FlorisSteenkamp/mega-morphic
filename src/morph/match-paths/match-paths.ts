import type { FatBranch, FatBranchEdge } from '../fat-branch/fat-branch.js';
import {
    getSkeletonBeziers, getSkeletonRadii
} from '../fat-branch/get-fat-branch-tree.js';
import { unwrappedChordAngles } from '../intrinsic-skeleton.js';
import { edgeIndexAt } from '../edge-index-at.js';
import { flipTrunkEdges, trunkTurning, angleDist } from '../match-trees/match-trees.js';
import { clamp } from '../../utils/clamp.js';
import { length } from 'flo-bezier3';

const { abs, max, min, PI: π } = Math;


/**
 * Correspondence-driven PATH matching ("level 3"): the matching unit is a
 * junction-to-leaf path (a chain of fat branches descending the MAT tree),
 * and the relabel metric is the actual DTW alignability of the two paths'
 * radius + turning profiles. Merge/split (one branch corresponding to a
 * chain in the other tree) is native: it is simply a path with more than
 * one node. Off-path leaf-side stubs and unmatched leaf tails retract.
 */


/** One hop of a path: the branch, and the child edge the path continues
 *  through (undefined = the path ends at this branch's own leaf tip). */
interface PathNode {
    readonly branch: FatBranch;
    readonly exit?: FatBranchEdge;
}

/** A child fork lying ON a path (pooled across the path's nodes). */
interface PooledChild {
    readonly edge: FatBranchEdge;
    /** skeleton arc distance from the path's leaf end to the fork */
    readonly dist: number;
}

/** ops on the pooled child forks of a matched path pair */
type PathChildOp =
    | { type: 'match'; a: PooledChild; b: PooledChild; sub: MatchedPath }
    | { type: 'delete'; a: PooledChild }
    | { type: 'insert'; b: PooledChild };

/** A matched pair of junction-to-leaf paths with its recursive sub-match. */
interface MatchedPath {
    /** path in tree 1, junction side first, leaf last */
    readonly a: PathNode[];
    /** path in tree 2, junction side first, leaf last */
    readonly b: PathNode[];
    /** total subtree match cost (shape + tails + stubs + children) */
    readonly cost: number;
    /** the profile-alignment (DTW) part alone */
    readonly shapeCost: number;
    /** unmatched leaf-side fraction of the composed path (retracts) */
    readonly tailA: number;
    readonly tailB: number;
    readonly children: PathChildOp[];
}

interface PathMatchResult {
    readonly trunk: MatchedPath;
    readonly flipped: boolean;
    readonly cost: number;
}


/**
 * Relative importance of each (dimensionless) cost term - all tunable.
 */
interface PathCostWeights {
    /** profile (radius + turning) mismatch, scaled by matched length */
    readonly shape: number;
    /** fork position mismatch along the paths */
    readonly position: number;
    /** fork emanating-angle mismatch */
    readonly angle: number;
    /** unmatched subtree delete/insert (per salience fraction) */
    readonly del: number;
    /** flat delete/insert floor (small branches aren't free to drop) */
    readonly delFloor: number;
    /** off-path leaf-side stub (per salience fraction) */
    readonly stub: number;
    /** unmatched leaf tail (per normalized length) */
    readonly tail: number;
    /** trunk total-turning mismatch (orientation decision only) */
    readonly turn: number;
    /** interior alignment gap open/extend (profile samples) */
    readonly gapOpen: number;
    readonly gapExtend: number;
}

const defaultPathWeights: PathCostWeights = {
    shape: 1,
    position: 0.5,
    angle: 0.25,
    del: 3,
    delFloor: 0.15,
    stub: 3,
    tail: 0.5,
    turn: 0.25,
    gapOpen: 0.15,
    gapExtend: 0.06
};

interface PathMatchOptions {
    readonly weights?: Partial<PathCostWeights>;
}


/**
 * Matches the two fat branch trees path-wise. The trunks are assumed
 * matched (tried in both orientations, as in `matchTrees`); below them,
 * every matched fork pair recursively picks the cheapest pair of
 * junction-to-leaf paths through its two subtrees.
 */
function matchPaths(
        tree1: FatBranch,
        tree2: FatBranch,
        opts: PathMatchOptions = {}): PathMatchResult {

    const w: PathCostWeights = { ...defaultPathWeights, ...opts.weights };

    const ctx = makeContext(tree1, tree2, w);

    const turn1 = trunkTurning(tree1);
    const turn2 = trunkTurning(tree2);

    const normal = matchTrunk(ctx, tree1, tree2, false);
    const flippedM = matchTrunk(ctx, tree1, tree2, true);

    const costN = normal.cost + w.turn * abs(turn1 - turn2) / π;
    const costF = flippedM.cost + w.turn * abs(turn1 + turn2) / π;

    const flipped = costF < costN;

    return {
        trunk: flipped ? flippedM : normal,
        flipped,
        cost: flipped ? costF : costN
    };
}


// ---- Matching context --------------------------------------------------------

/** A path's composed geometry and derived features. */
interface PathGeom {
    readonly nodes: PathNode[];
    /** composite skeleton, leaf → junction */
    readonly bz: number[][][];
    readonly rd: number[];
    /** total skeleton length */
    readonly L: number;
    /** summed salience of off-path leaf-side stubs */
    readonly stubSal: number;
    /** on-path child forks (excluding exits) */
    readonly pooled: PooledChild[];
    samples?: Samples;
}

interface Context {
    readonly w: PathCostWeights;
    readonly unit1: number;
    readonly unit2: number;
    readonly sal1: number;
    readonly sal2: number;
    readonly paths1: (br: FatBranch) => PathGeom[];
    readonly paths2: (br: FatBranch) => PathGeom[];
    readonly memo: Map<string, MatchedPath>;
}

function makeContext(
        tree1: FatBranch,
        tree2: FatBranch,
        w: PathCostWeights): Context {

    return {
        w,
        unit1: Math.sqrt(tree1.roundSalience),
        unit2: Math.sqrt(tree2.roundSalience),
        sal1: tree1.roundSalience,
        sal2: tree2.roundSalience,
        paths1: makePathCache(),
        paths2: makePathCache(),
        memo: new Map()
    };
}

function branchId(br: FatBranch): number {
    return br.cpChain[0].id;
}


// ---- Path enumeration --------------------------------------------------------

/** Memoized enumeration of all junction-to-leaf paths under a branch
 *  (one per leaf of the subtree), with composed geometry. */
function makePathCache(): (br: FatBranch) => PathGeom[] {
    const cache = new Map<FatBranch, PathGeom[]>();

    return function pathsOf(br: FatBranch): PathGeom[] {
        const cached = cache.get(br);
        if (cached !== undefined) { return cached; }

        const bz = getSkeletonBeziers(br);
        const rd = getSkeletonRadii(br);
        const lens = bz.map(ps => length([0, 1], ps));
        const L = lens.reduce((s, l) => s + l, 0);
        const children = br.children ?? [];

        // The path ending at this branch's own leaf tip.
        const own: PathGeom = {
            nodes: [{ branch: br }],
            bz, rd, L,
            stubSal: 0,
            pooled: children.map(edge =>
                ({ edge, dist: edge.distanceFromLeaf }))
        };

        const out: PathGeom[] = [own];

        // Paths continuing through a child: the child's sub-path plus this
        // branch's stretch from the exit fork to its junction; the leaf-side
        // stub (incl. anything hanging off it) goes unmatched.
        for (const exit of children) {
            const j = edgeIndexAt(bz, exit.distanceFromLeaf);
            const stretchBz = bz.slice(j);
            const stretchRd = rd.slice(j + 1);
            // Measure from the actual slice knot so pooled distances land
            // exactly on the composed skeleton.
            const jLen = lens.slice(0, j).reduce((s, l) => s + l, 0);
            const stretchL = L - jLen;

            const onPath = children
                .filter(e => e !== exit &&
                    e.distanceFromLeaf >= exit.distanceFromLeaf);

            for (const sub of pathsOf(exit.branch)) {
                out.push({
                    nodes: [{ branch: br, exit }, ...sub.nodes],
                    bz: [...sub.bz, ...stretchBz],
                    rd: [...sub.rd, ...stretchRd],
                    L: sub.L + stretchL,
                    stubSal: sub.stubSal + exit.roundSalienceFromLeaf,
                    pooled: [
                        ...sub.pooled,
                        ...onPath.map(edge => ({
                            edge,
                            dist: sub.L + (edge.distanceFromLeaf - jLen)
                        }))
                    ]
                });
            }
        }

        cache.set(br, out);
        return out;
    };
}


// ---- Subtree matching --------------------------------------------------------

/** Cheapest path-pair match of the two subtrees hanging at a matched fork
 *  pair (memoized on the branch pair). */
function matchSubtrees(
        ctx: Context,
        brA: FatBranch,
        brB: FatBranch): MatchedPath {

    const key = branchId(brA) + '|' + branchId(brB);
    const cached = ctx.memo.get(key);
    if (cached !== undefined) { return cached; }

    let best: MatchedPath | undefined;

    for (const pA of ctx.paths1(brA)) {
        for (const pB of ctx.paths2(brB)) {
            const m = matchPathPair(ctx, pA, pB, false);
            if (best === undefined || m.cost < best.cost) { best = m; }
        }
    }

    ctx.memo.set(key, best!);
    return best!;
}


/** Match one concrete path pair: profile DTW + tails + stubs + recursive
 *  pooled-children alignment. */
function matchPathPair(
        ctx: Context,
        pA: PathGeom,
        pB: PathGeom,
        trunkLevel: boolean): MatchedPath {

    const { w } = ctx;

    const fA = pA.samples ??= sampleFeatures(pA.bz, pA.rd, ctx.unit1);
    const fB = pB.samples ??= sampleFeatures(pB.bz, pB.rd, ctx.unit2);

    const LnA = pA.L / ctx.unit1;
    const LnB = pB.L / ctx.unit2;

    const al = alignProfiles(
        fA, fB,
        LnA / (fA.u.length - 1),
        LnB / (fB.u.length - 1),
        trunkLevel,  // the trunk's junction ends are leaf tips too
        w);

    const shapeCost = al.cost - al.tailPen;
    const tailCost = al.tailPen;
    const stubCost = w.stub *
        (pA.stubSal / ctx.sal1 + pB.stubSal / ctx.sal2);

    const { ops, cost: childCost } = matchPooled(
        ctx, pA.pooled, pB.pooled);

    return {
        a: pA.nodes,
        b: pB.nodes,
        cost: shapeCost + tailCost + stubCost + childCost,
        shapeCost,
        tailA: al.tailStartA,
        tailB: al.tailStartB,
        children: ops
    };
}


/** Per-side monotone alignment of two paths' pooled child forks. */
function matchPooled(
        ctx: Context,
        pooledA: PooledChild[],
        pooledB: PooledChild[]): { ops: PathChildOp[]; cost: number } {

    const { w } = ctx;

    const relabel = (a: PooledChild, b: PooledChild): number =>
        w.position * abs(a.dist/ctx.unit1 - b.dist/ctx.unit2) +
        w.angle * angleDist(a.edge.angle, b.edge.angle) / π +
        matchSubtrees(ctx, a.edge.branch, b.edge.branch).cost;
    const delCost = (a: PooledChild): number =>
        w.delFloor + w.del * a.edge.branch.roundSalience / ctx.sal1;
    const insCost = (b: PooledChild): number =>
        w.delFloor + w.del * b.edge.branch.roundSalience / ctx.sal2;

    const ops: PathChildOp[] = [];
    let cost = 0;

    for (const side of [1, -1] as const) {
        // Boundary-walk order: out side ascending, back side descending.
        const As = pooledA.filter(c => c.edge.side === side)
            .sort((x, y) => side * (x.dist - y.dist));
        const Bs = pooledB.filter(c => c.edge.side === side)
            .sort((x, y) => side * (x.dist - y.dist));

        const r = alignSeq(As, Bs, relabel, delCost, insCost);
        cost += r.cost;
        for (const op of r.ops) {
            ops.push(op.type === 'match'
                ? { type: 'match', a: op.a, b: op.b,
                    sub: matchSubtrees(
                        ctx, op.a.edge.branch, op.b.edge.branch) }
                : op);
        }
    }

    return { ops, cost };
}


/** The trunk pair (single-node paths, both orientations of tree2). */
function matchTrunk(
        ctx: Context,
        tree1: FatBranch,
        tree2: FatBranch,
        flip: boolean): MatchedPath {

    const bz1 = getSkeletonBeziers(tree1);
    const rd1 = getSkeletonRadii(tree1);
    let bz2 = getSkeletonBeziers(tree2);
    let rd2 = getSkeletonRadii(tree2);
    if (flip) {
        bz2 = bz2.slice().reverse().map(ps => ps.slice().reverse());
        rd2 = rd2.slice().reverse();
    }

    const L1 = bz1.reduce((s, ps) => s + length([0, 1], ps), 0);
    const L2 = bz2.reduce((s, ps) => s + length([0, 1], ps), 0);

    const pA: PathGeom = {
        nodes: [{ branch: tree1 }],
        bz: bz1, rd: rd1, L: L1, stubSal: 0,
        pooled: (tree1.children ?? []).map(edge =>
            ({ edge, dist: edge.distanceFromLeaf }))
    };
    const edges2 = flip ? flipTrunkEdges(tree2) : (tree2.children ?? []);
    const pB: PathGeom = {
        nodes: [{ branch: tree2 }],
        bz: bz2, rd: rd2, L: L2, stubSal: 0,
        pooled: edges2.map(edge => ({ edge, dist: edge.distanceFromLeaf }))
    };

    return matchPathPair(ctx, pA, pB, true);
}


// ---- Feature sampling --------------------------------------------------------

interface Samples {
    readonly u: number[];
    readonly r: number[];
    readonly turn: number[];
}

/** Radius + turning-rate profile, leaf (u=0) → junction (u=1). */
function sampleFeatures(
        bz: number[][][],
        rd: number[],
        unit: number): Samples {

    const n = clamp(2 * bz.length, 24, 160);

    const lens = bz.map(ps => length([0, 1], ps));
    const total = lens.reduce((s, l) => s + l, 0);
    const knots = [0];
    let cum = 0;
    for (const l of lens) {
        cum += l;
        knots.push(total > 0 ? cum / total : 0);
    }
    knots[knots.length - 1] = 1;

    const φs = padProfile(unwrappedChordAngles(bz), rd.length);

    const u: number[] = [];
    const r: number[] = [];
    const φ: number[] = [];
    for (let i = 0; i < n; i++) {
        const ui = i / (n - 1);
        u.push(ui);
        r.push(valueAt(rd, knots, ui) / unit);
        φ.push(valueAt(φs, knots, ui));
    }

    const turn: number[] = [];
    for (let i = 0; i < n; i++) {
        const i0 = max(0, i - 1);
        const i1 = min(n - 1, i + 1);
        turn.push((φ[i1] - φ[i0]) / (u[i1] - u[i0]));
    }

    return { u, r, turn };
}

/** Chord angles live per segment (rd is per boundary): pad to align. */
function padProfile(φs: number[], m: number): number[] {
    const out = φs.slice();
    while (out.length < m) { out.push(out[out.length - 1] ?? 0); }
    return out;
}

/** Piecewise-linear value over `knots` at normalized position `u`. */
function valueAt(vals: number[], knots: number[], u: number): number {
    let j = 0;
    while (j < knots.length - 2 && knots[j + 1] <= u) { j++; }
    const span = knots[j + 1] - knots[j];
    const f = span <= 0 ? 0 : clamp((u - knots[j]) / span, 0, 1);

    return vals[j]*(1 - f) + vals[min(j + 1, vals.length - 1)]*f;
}


// ---- Profile alignment with priced leaf tails --------------------------------

/** radius-profile difference weight (same scale as align-branches) */
const W_RADIUS = 1;
/** turning-rate difference weight */
const W_TURN = 0.15;

interface TailAlign {
    /** total alignment cost including tail penalties */
    readonly cost: number;
    /** summed tail penalties */
    readonly tailPen: number;
    /** unmatched u fractions at the leaf (start) ends */
    readonly tailStartA: number;
    readonly tailStartB: number;
    /** unmatched u fractions at the junction (end) ends - trunk only */
    readonly tailEndA: number;
    readonly tailEndB: number;
}

/**
 * Gotoh affine-gap alignment of two profiles with PRICED end skips at the
 * leaf ends (sample index 0): the alignment may start at (i,0) or (0,j),
 * paying the tail weight per skipped arc length - the skipped stretch is
 * the retracting leaf tail. The junction ends are pinned (`bothEnds` also
 * prices skips there - for the trunk, whose both ends are leaf tips).
 * ALL costs are integrated over normalized arc length (`stepA`/`stepB` =
 * length per sample), keeping match, gap and tail prices commensurate.
 */
function alignProfiles(
        fA: Samples,
        fB: Samples,
        stepA: number,
        stepB: number,
        bothEnds: boolean,
        w: PathCostWeights): TailAlign {

    const nA = fA.u.length;
    const nB = fB.u.length;
    const OPEN = w.gapOpen;
    const extA = w.gapExtend * stepA;
    const extB = w.gapExtend * stepB;
    const tailUnitA = w.tail * stepA;
    const tailUnitB = w.tail * stepB;
    const diagStep = w.shape * (stepA + stepB) / 2;

    // Mirror-invariant turning (see align-branches).
    const cost = (i: number, j: number): number =>
        diagStep * (W_RADIUS*abs(fA.r[i] - fB.r[j])
            + W_TURN*abs(abs(fA.turn[i]) - abs(fB.turn[j])) / (2*π));

    const INF = Infinity;
    const M: number[][] = [];
    const Ix: number[][] = [];
    const Iy: number[][] = [];
    const fromM: (0 | 1 | 2)[][] = [];
    for (let i = 0; i < nA; i++) {
        M.push(new Array(nB).fill(INF));
        Ix.push(new Array(nB).fill(INF));
        Iy.push(new Array(nB).fill(INF));
        fromM.push(new Array(nB).fill(0) as (0 | 1 | 2)[]);
    }

    // Fresh starts along the leaf edges (the only way M is set at i=0/j=0).
    M[0][0] = cost(0, 0);
    for (let i = 1; i < nA; i++) {
        M[i][0] = i*tailUnitA + cost(i, 0);
        Ix[i][0] = min(M[i - 1][0] + OPEN, Ix[i - 1][0]) + extA;
    }
    for (let j = 1; j < nB; j++) {
        M[0][j] = j*tailUnitB + cost(0, j);
        Iy[0][j] = min(M[0][j - 1] + OPEN, Iy[0][j - 1]) + extB;
    }

    for (let i = 1; i < nA; i++) {
        for (let j = 1; j < nB; j++) {
            const prevM = M[i - 1][j - 1];
            const prevIx = Ix[i - 1][j - 1];
            const prevIy = Iy[i - 1][j - 1];
            const best = min(prevM, prevIx, prevIy);
            M[i][j] = best + cost(i, j);
            fromM[i][j] = best === prevM ? 0 : best === prevIx ? 1 : 2;

            Ix[i][j] = min(M[i - 1][j] + OPEN, Ix[i - 1][j]) + extA;
            Iy[i][j] = min(M[i][j - 1] + OPEN, Iy[i][j - 1]) + extB;
        }
    }

    // Terminal: pinned at (nA-1, nB-1), or (trunk) priced end skips.
    let bi = nA - 1;
    let bj = nB - 1;
    let bState: 0 | 1 | 2 = stateAt(bi, bj);
    let bCost = valAt(bi, bj, bState);
    let endTailA = 0;
    let endTailB = 0;

    if (bothEnds) {
        for (let i = 0; i < nA - 1; i++) {
            const s = stateAt(i, nB - 1);
            const v = valAt(i, nB - 1, s) + (nA - 1 - i)*tailUnitA;
            if (v < bCost) {
                bCost = v; bi = i; bj = nB - 1; bState = s;
                endTailA = nA - 1 - i; endTailB = 0;
            }
        }
        for (let j = 0; j < nB - 1; j++) {
            const s = stateAt(nA - 1, j);
            const v = valAt(nA - 1, j, s) + (nB - 1 - j)*tailUnitB;
            if (v < bCost) {
                bCost = v; bi = nA - 1; bj = j; bState = s;
                endTailA = 0; endTailB = nB - 1 - j;
            }
        }
    }

    // Traceback for the start tails.
    let i = bi;
    let j = bj;
    let state = bState;
    while (!(state === 0 && (i === 0 || j === 0))) {
        if (state === 0) {
            const s = fromM[i][j];
            i--; j--;
            state = s;
        } else if (state === 1) {
            state = i > 1 && Ix[i - 1][j] <= M[i - 1][j] + OPEN ? 1 : 0;
            i--;
        } else {
            state = j > 1 && Iy[i][j - 1] <= M[i][j - 1] + OPEN ? 2 : 0;
            j--;
        }
    }

    const tailPen = i*tailUnitA + j*tailUnitB
        + endTailA*tailUnitA + endTailB*tailUnitB;

    return {
        cost: bCost,
        tailPen,
        tailStartA: fA.u[i],
        tailStartB: fB.u[j],
        tailEndA: endTailA / (nA - 1),
        tailEndB: endTailB / (nB - 1)
    };

    function stateAt(x: number, y: number): 0 | 1 | 2 {
        return M[x][y] <= Ix[x][y] && M[x][y] <= Iy[x][y] ? 0
            : Ix[x][y] <= Iy[x][y] ? 1 : 2;
    }
    function valAt(x: number, y: number, s: 0 | 1 | 2): number {
        return s === 0 ? M[x][y] : s === 1 ? Ix[x][y] : Iy[x][y];
    }
}


// ---- Monotone sequence alignment ---------------------------------------------

type SeqOp<A, B> =
    | { type: 'match'; a: A; b: B }
    | { type: 'delete'; a: A }
    | { type: 'insert'; b: B };

function alignSeq<A, B>(
        as: A[],
        bs: B[],
        mCost: (a: A, b: B) => number,
        dCost: (a: A) => number,
        iCost: (b: B) => number): { cost: number; ops: SeqOp<A, B>[] } {

    const n = as.length;
    const m = bs.length;

    const D: number[][] = [];
    for (let i = 0; i <= n; i++) { D.push(new Array(m + 1).fill(0)); }
    for (let i = 1; i <= n; i++) { D[i][0] = D[i - 1][0] + dCost(as[i - 1]); }
    for (let j = 1; j <= m; j++) { D[0][j] = D[0][j - 1] + iCost(bs[j - 1]); }

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            D[i][j] = min(
                D[i - 1][j - 1] + mCost(as[i - 1], bs[j - 1]),
                D[i - 1][j] + dCost(as[i - 1]),
                D[i][j - 1] + iCost(bs[j - 1])
            );
        }
    }

    const ops: SeqOp<A, B>[] = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 &&
            D[i][j] === D[i - 1][j - 1] + mCost(as[i - 1], bs[j - 1])) {
            ops.push({ type: 'match', a: as[i - 1], b: bs[j - 1] });
            i--; j--;
        } else if (i > 0 && D[i][j] === D[i - 1][j] + dCost(as[i - 1])) {
            ops.push({ type: 'delete', a: as[i - 1] });
            i--;
        } else {
            ops.push({ type: 'insert', b: bs[j - 1] });
            j--;
        }
    }
    ops.reverse();

    return { cost: D[n][m], ops };
}


export { matchPaths, defaultPathWeights }
export type {
    PathMatchResult, MatchedPath, PathNode, PathChildOp, PooledChild,
    PathCostWeights, PathMatchOptions
}
