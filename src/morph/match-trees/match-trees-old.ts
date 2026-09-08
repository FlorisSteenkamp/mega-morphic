import type { CpNode } from 'flo-mat';
import type { Pose, Similarity } from '../procrustes-analysis.js';
import type { BranchTree } from '../branch-tree/branch-tree.js';
import { getMatCurveToNext } from 'flo-mat';
import { getBranchTree } from '../branch-tree/get-branch-tree.js';
import { alignSimilarity, applySimilarity } from '../procrustes-analysis.js';


/** A single branch of `tree1` matched to a single branch of `tree2`. */
type MatchedPair = [BranchTree, BranchTree];


/**
 * The full correspondence between two branch trees.
 */
interface MatchResult {
    /** branches matched one-to-one */
    readonly pairs: MatchedPair[];
    /** branches in `tree1` with no counterpart (collapse when morphing) */
    readonly deleted: BranchTree[];
    /** branches in `tree2` with no counterpart (grow when morphing) */
    readonly inserted: BranchTree[];
    /** the total edit cost of the matching */
    readonly cost: number;
    /** glyph2 → glyph1 alignment used (only when poses are supplied). */
    transform?: Similarity;
}


type EditOp =
    | { type: 'match'; a: BranchTree; b: BranchTree }
    | { type: 'delete'; a: BranchTree }
    | { type: 'insert'; b: BranchTree };

type Edit = { cost: number; ops: EditOp[] };


/** Relative importance of each geometric term in the relabel cost. */
interface CostWeights {
    readonly len: number;
    readonly angle: number;
    readonly endpoint: number;
    /**
     * Per-level falloff of a branch's matching weight. The root (core of the
     * shape) has weight 1; each step towards the leaves multiplies by this
     * factor, so outer branches matter less than the core. Use 1 to disable.
     */
    readonly depthDecay: number;
}

const defaultWeights: CostWeights = {
    len: 1,
    angle: 0,
    endpoint: 0,
    depthDecay: 0
};


/** Options controlling the (optional) geometry-aware matching. */
interface MatchOptions {
    // readonly pose1?: Pose;
    // readonly pose2?: Pose;
    readonly weights?: CostWeights;
}


/** The edit-cost model used while matching (closes over alignment + weights). */
interface Cost {
    relabel(a: BranchTree, b: BranchTree): number;
    delete(a: BranchTree): number;
    insert(b: BranchTree): number;
}


/**
 * Matches the branches of `tree1` to those of `tree2`.
 *
 * Both trees are rerooted at their largest vertex and ordered by angle, then
 * matched with an ordered tree edit distance.
 *
 * With no poses the cost is branch-`length`-only (topology-only matching). When
 * `pose1`/`pose2` are supplied the cost is geometry-aware: branches are compared
 * in a shared (procrustes-aligned) frame by length, leave-angle and endpoint
 * distance, and both the 0° and 180° principal-axis alignments are tried.
 */
function matchTrees(
        tree1: BranchTree,
        tree2: BranchTree,
        opts: MatchOptions = {}): MatchResult {

    const bt1 = rerootAtLargestVertex(tree1);
    const bt2 = rerootAtLargestVertex(tree2);
    orderByAngle(bt1);
    orderByAngle(bt2);

    const {
        // pose1, pose2,
        weights = defaultWeights
    } = opts;

    const depth1 = buildDepthMap(bt1);
    const depth2 = buildDepthMap(bt2);

    // Topology-only: single length-based pass.
    // if (!pose1 || !pose2) {
        const cost = makeCost(weights, depth1, depth2);
        return toResult(editForest([bt1], [bt2], new Map(), cost));
    // }

    // Geometry-aware: try both principal-axis alignments, keep the cheaper.
    // let best: MatchResult | undefined;
    // for (const flip of [false, true]) {
    //     const transform = alignSimilarity(pose2, pose1, flip);
    //     const cost = makeCost(weights, depth1, depth2, pose1, pose2, transform);
    //     const result = toResult(editForest([bt1], [bt2], new Map(), cost));
    //     result.transform = transform;
    //     if (!best || result.cost < best.cost) { best = result; }
    // }

    // return best!;
}


/** Splits an edit into matched pairs, deletions and insertions. */
function toResult(edit: Edit): MatchResult {
    const pairs: MatchedPair[] = [];
    const deleted: BranchTree[] = [];
    const inserted: BranchTree[] = [];
    for (const op of edit.ops) {
        if (op.type === 'match') { pairs.push([op.a, op.b]); }
        else if (op.type === 'delete') { deleted.push(op.a); }
        else { inserted.push(op.b); }
    }

    return { pairs, deleted, inserted, cost: edit.cost };
}


// ---- Cost model ------------------------------------------------------------

/** Euclidean distance between two points. */
function dist(p: number[], q: number[]): number {
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
}

/** Smallest absolute angular difference, wrapped to [0, π]. */
function angleDist(a: number, b: number): number {
    let d = Math.abs(a - b) % (2 * Math.PI);
    if (d > Math.PI) { d = 2 * Math.PI - d; }

    return d;
}

/** The start point of a branch (start of its first mat-curve). */
function branchStart(node: BranchTree): number[] {
    return getMatCurveToNext(node.branch[0])[0];
}

/** The end point of a branch (end of its last mat-curve). */
function branchEnd(node: BranchTree): number[] {
    const ps = getMatCurveToNext(node.branch[node.branch.length - 1]);

    return ps[ps.length - 1];
}

/**
 * Builds the edit-cost model. Length-only when no poses are given; otherwise
 * geometry-aware in the aligned frame (`transform` maps glyph2 → glyph1).
 *
 * Every term is scaled by a depth weight (`depthDecay ** depth`) so branches
 * near the core matter more than outer leaves.
 */
function makeCost(
        weights: CostWeights,
        depth1: Map<BranchTree, number>,
        depth2: Map<BranchTree, number>): Cost {
        // pose1?: Pose,
        // pose2?: Pose,
        // transform?: Similarity): Cost {

    const decay = weights.depthDecay;
    const w1 = (a: BranchTree) => Math.pow(decay, depth1.get(a) ?? 0);
    const w2 = (b: BranchTree) => Math.pow(decay, depth2.get(b) ?? 0);
    // Symmetric weight for a matched pair (keeps total cost swap-invariant).
    const wPair = (a: BranchTree, b: BranchTree) => Math.sqrt(w1(a) * w2(b));

    // if (!pose1 || !pose2 || !transform) {
        return {
            relabel: (a, b) => wPair(a, b) * Math.abs(a.length - b.length),
            delete: a => w1(a) * a.length,
            insert: b => w2(b) * b.length,
        };
    // }

    // const s1 = pose1.scale;
    // const s2 = pose2.scale;
    // const w = weights;

    // return {
    //     relabel(a, b) {
    //         const dLen = Math.abs(a.length / s1 - b.length / s2);
    //         const dAng = angleDist(branchAngle(a), branchAngle(b) + transform.rot) / Math.PI;
    //         const dEnd = (
    //             dist(branchStart(a), applySimilarity(transform, branchStart(b))) +
    //             dist(branchEnd(a), applySimilarity(transform, branchEnd(b)))
    //         ) / (2 * s1);

    //         return wPair(a, b) * (w.len * dLen + w.angle * dAng + w.endpoint * dEnd);
    //     },
    //     delete: a => w1(a) * w.len * a.length / s1,
    //     insert: b => w2(b) * w.len * b.length / s2,
    // };
}

/** Maps each branch node to its depth from the root (root = 0). */
function buildDepthMap(tree: BranchTree): Map<BranchTree, number> {
    const map = new Map<BranchTree, number>();
    const walk = (node: BranchTree, depth: number) => {
        map.set(node, depth);
        for (const child of node.children) { walk(child, depth + 1); }
    };
    walk(tree, 0);

    return map;
}


/** The direction (radians) in which a branch leaves its start vertex. */
function branchAngle(node: BranchTree): number {
    const ps = getMatCurveToNext(node.branch[0]);
    const p0 = ps[0];
    const p1 = ps[ps.length - 1];

    return Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
}

/** Orders every node's children by angle, making the tree an ordered tree. */
function orderByAngle(node: BranchTree): void {
    node.children.sort((a, b) => branchAngle(a) - branchAngle(b));
    for (const child of node.children) { orderByAngle(child); }
}


/** The `CpNode` with the largest maximal-disk radius in the tree. */
function largestVertex(node: BranchTree): { cpNode: CpNode; radius: number } {
    let best = {
        cpNode: node.branch[0],
        radius: node.branch[0].pointOnShape.circle.radius,
    };

    for (const cpNode of node.branch) {
        const radius = cpNode.pointOnShape.circle.radius;
        if (radius > best.radius) { best = { cpNode, radius }; }
    }
    for (const child of node.children) {
        const childBest = largestVertex(child);
        if (childBest.radius > best.radius) { best = childBest; }
    }

    return best;
}

/** Rebuilds the tree rooted at its largest vertex. */
function rerootAtLargestVertex(tree: BranchTree): BranchTree {
    return getBranchTree(largestVertex(tree).cpNode);
}


/** All nodes of a forest (each element is a complete subtree). */
function allNodes(forest: BranchTree[]): BranchTree[] {
    const out: BranchTree[] = [];
    const stack = [...forest];
    while (stack.length > 0) {
        const node = stack.pop()!;
        out.push(node);
        for (const child of node.children) { stack.push(child); }
    }

    return out;
}

/** Identifies a forest by its ordered subtree-root ids. */
function forestKey(forest: BranchTree[]): string {
    return forest.map(node => node.branch[0].id).join(',');
}

function minEdit(edits: Edit[]): Edit {
    return edits.reduce((best, e) => (e.cost < best.cost ? e : best));
}


/**
 * Ordered edit distance between two forests (ordered lists of complete
 * subtrees), returning both the cost and the operations that achieve it.
 *
 * Supports relabel (match), delete and insert; a branch mapping to a chain of
 * branches (merge/split) arises naturally from deletes/inserts adjacent to a
 * match.
 */
function editForest(
        F: BranchTree[],
        G: BranchTree[],
        memo: Map<string, Edit>,
        cost: Cost): Edit {

    const key = forestKey(F) + '|' + forestKey(G);
    const cached = memo.get(key);
    if (cached) { return cached; }

    let result: Edit;

    if (F.length === 0 && G.length === 0) {
        result = { cost: 0, ops: [] };
    } else if (F.length === 0) {
        const nodes = allNodes(G);
        result = {
            cost: nodes.reduce((s, b) => s + cost.insert(b), 0),
            ops: nodes.map((b): EditOp => ({ type: 'insert', b })),
        };
    } else if (G.length === 0) {
        const nodes = allNodes(F);
        result = {
            cost: nodes.reduce((s, a) => s + cost.delete(a), 0),
            ops: nodes.map((a): EditOp => ({ type: 'delete', a })),
        };
    } else {
        const i = F[F.length - 1];
        const j = G[G.length - 1];
        const Frest = F.slice(0, -1);
        const Grest = G.slice(0, -1);

        // Delete i, promoting its children into the forest.
        const del = editForest(Frest.concat(i.children), G, memo, cost);
        const delEdit: Edit = {
            cost: cost.delete(i) + del.cost,
            ops: del.ops.concat({ type: 'delete', a: i }),
        };

        // Insert j, promoting its children into the forest.
        const ins = editForest(F, Grest.concat(j.children), memo, cost);
        const insEdit: Edit = {
            cost: cost.insert(j) + ins.cost,
            ops: ins.ops.concat({ type: 'insert', b: j }),
        };

        // Match i with j: align their children and the remaining forests.
        const children = editForest(i.children, j.children, memo, cost);
        const rest = editForest(Frest, Grest, memo, cost);
        const matchEdit: Edit = {
            cost: cost.relabel(i, j) + children.cost + rest.cost,
            ops: children.ops.concat(rest.ops, { type: 'match', a: i, b: j }),
        };

        result = minEdit([delEdit, insEdit, matchEdit]);
    }

    memo.set(key, result);
    return result;
}


export { matchTrees }
export type { MatchResult, MatchedPair, MatchOptions, CostWeights }

