import type { FatBranch, FatBranchEdge } from '../fat-branch.js';


/** A single fat branch of `tree1` matched to a single fat branch of `tree2`. */
type MatchedPair = [FatBranch, FatBranch];


/**
 * The full correspondence between two fat branch trees.
 */
interface MatchResult {
    /** branches matched one-to-one (the trunks are always the first pair) */
    readonly pairs: MatchedPair[];
    /** branches in `tree1` with no counterpart (collapse when morphing) */
    readonly deleted: FatBranch[];
    /** branches in `tree2` with no counterpart (grow when morphing) */
    readonly inserted: FatBranch[];
    /** the total edit cost of the matching */
    readonly cost: number;
}


type EditOp =
    | { type: 'match'; a: FatBranchEdge; b: FatBranchEdge }
    | { type: 'delete'; a: FatBranchEdge }
    | { type: 'insert'; b: FatBranchEdge };

type Edit = { cost: number; ops: EditOp[] };


/**
 * Relative importance of each (per-tree normalized, unitless) term in the
 * relabel cost.
 */
interface CostWeights {
    /** attachment position along the parent (from its leaf tip) */
    readonly distance: number;
    /** partial round salience from the parent's leaf tip */
    readonly salience: number;
    /** emanating angle relative to the parent */
    readonly angle: number;
}

const defaultWeights: CostWeights = {
    distance: 1,
    salience: 1,
    angle: 0.5
};


interface MatchOptions {
    readonly weights?: CostWeights;
    /**
     * Maximum weighted feature distance for two branches to be matched; a
     * candidate pair costing more is left unmatched (deleted + inserted).
     */
    readonly cutoff?: number;
}


/** The edit-cost model used while matching. */
interface Cost {
    relabel(a: FatBranchEdge, b: FatBranchEdge): number;
    delete(a: FatBranchEdge): number;
    insert(b: FatBranchEdge): number;
}


/**
 * Matches the fat branches of `tree1` to those of `tree2` (as produced by
 * `getFatBranchTree`).
 *
 * The trunks are assumed matched. Their children are then matched with an
 * ordered forest edit distance on the edge features `distanceFromLeaf`,
 * `roundSalienceFromLeaf` and `angle` (normalized per tree so the weights and
 * cutoff are scale-free), then grandchildren of matched pairs, etc.
 */
function matchTrees(
        tree1: FatBranch,
        tree2: FatBranch,
        opts: MatchOptions = {}): MatchResult {

    const {
        weights = defaultWeights,
        cutoff = 1
    } = opts;

    const cost = makeCost(weights, cutoff, tree1, tree2);

    const children1 = tree1.children ?? [];
    const children2 = tree2.children ?? [];

    const edit = editForest(children1, children2, new Map(), cost);

    const pairs: MatchedPair[] = [[tree1, tree2]];
    const deleted: FatBranch[] = [];
    const inserted: FatBranch[] = [];
    for (const op of edit.ops) {
        if (op.type === 'match') { pairs.push([op.a.branch, op.b.branch]); }
        else if (op.type === 'delete') { deleted.push(op.a.branch); }
        else { inserted.push(op.b.branch); }
    }

    return { pairs, deleted, inserted, cost: edit.cost };
}


// ---- Cost model ------------------------------------------------------------

/**
 * Builds the edit-cost model. Distances are normalized by √(trunk salience)
 * and saliences by the trunk salience of their own tree; angles by π. The
 * constant delete/insert costs make `cutoff` the exact break-even point:
 * relabeling a pair costing more than `cutoff` is never optimal.
 */
function makeCost(
        weights: CostWeights,
        cutoff: number,
        trunk1: FatBranch,
        trunk2: FatBranch): Cost {

    const unit1 = Math.sqrt(trunk1.roundSalience);
    const unit2 = Math.sqrt(trunk2.roundSalience);

    return {
        relabel: (a, b) =>
            weights.distance * Math.abs(
                a.distanceFromLeaf/unit1 - b.distanceFromLeaf/unit2
            ) +
            weights.salience * Math.abs(
                a.roundSalienceFromLeaf/trunk1.roundSalience -
                b.roundSalienceFromLeaf/trunk2.roundSalience
            ) +
            weights.angle * angleDist(a.angle, b.angle) / Math.PI,
        delete: () => cutoff/2,
        insert: () => cutoff/2,
    };
}


/** Smallest absolute difference between two angles (in [0, π]). */
function angleDist(x: number, y: number): number {
    const d = Math.abs(x - y) % (2*Math.PI);

    return d > Math.PI ? 2*Math.PI - d : d;
}


// ---- Ordered forest edit distance ------------------------------------------

function childrenOf(edge: FatBranchEdge): FatBranchEdge[] {
    return edge.branch.children ?? [];
}

/** All edges of a forest (each element is a complete subtree). */
function allNodes(forest: FatBranchEdge[]): FatBranchEdge[] {
    const out: FatBranchEdge[] = [];
    const stack = [...forest];
    while (stack.length > 0) {
        const edge = stack.pop()!;
        out.push(edge);
        for (const child of childrenOf(edge)) { stack.push(child); }
    }

    return out;
}

/** Identifies a forest by its ordered subtree-root branch ids. */
function forestKey(forest: FatBranchEdge[]): string {
    return forest.map(edge => edge.branch.cpChain[0].id).join(',');
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
        F: FatBranchEdge[],
        G: FatBranchEdge[],
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
        const del = editForest(Frest.concat(childrenOf(i)), G, memo, cost);
        const delEdit: Edit = {
            cost: cost.delete(i) + del.cost,
            ops: del.ops.concat({ type: 'delete', a: i }),
        };

        // Insert j, promoting its children into the forest.
        const ins = editForest(F, Grest.concat(childrenOf(j)), memo, cost);
        const insEdit: Edit = {
            cost: cost.insert(j) + ins.cost,
            ops: ins.ops.concat({ type: 'insert', b: j }),
        };

        // Match i with j: align their children and the remaining forests.
        const children = editForest(childrenOf(i), childrenOf(j), memo, cost);
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
