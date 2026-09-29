import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { PathAlignDebug } from '../match-paths/matched-path.js';
import type { SegMatchedPair, SegOp, SegChild, ChildPairPrice, RouteStep }
    from './match-seg-graphs.js';
import { matchSegGraphs, priceChildPair, reverseRoute }
    from './match-seg-graphs.js';
import { segGraphOf, routeSegments } from './segment-graph.js';
import { alignOfRoutes } from './match-paths-via-segments.js';
import { procrustes } from '../procrustes/procrustes-analysis.js';

const { sqrt } = Math;

const routeLenOf = (r: RouteStep[]): number => {
    let L = 0;
    for (const s of r) { L += s.seg.len; }
    return L;
};


/** How a clicked branch maps to a pooled child of the winning match. */
interface ChildLocation {
    readonly child: SegChild;
    /** the parent pair the child is pooled on */
    readonly pair: SegMatchedPair;
    /** 'inside subtree': the branch is buried in `child`'s hanging subtree */
    readonly role: 'edge-rooted' | 'continuation' | 'inside subtree';
    /** the winning match's actual decision for this child */
    readonly outcome: { type: SegOp['type']; partner?: SegChild };
}

interface ChildPairEval {
    readonly a?: ChildLocation;
    readonly b?: ChildLocation;
    /** pooled on the same parent pair (else the DP never compares them) */
    readonly sameParent?: boolean;
    /** in the same per-side alignment sequence (side/seam grouping) */
    readonly sameSequence?: boolean;
    readonly price?: ChildPairPrice;
    /** viz alignment of the pinned-start sub-DTW's winning route pair */
    readonly align?: PathAlignDebug;
    readonly verdict: string;
    /** the fresh winning match (current weights) */
    readonly root: SegMatchedPair;
}


/**
 * Prices a clicked child-branch pair with the segment matcher's actual
 * economics: a fresh `matchSegGraphs` run (current weights) locates the
 * branches as pooled children of the winning match, then the pair is priced
 * exactly as the matcher's relabel-vs-drop decision would price it.
 */
function evalChildPair(
        tree1: FatBranch,
        tree2: FatBranch,
        brA: FatBranch,
        brB: FatBranch,
        weights: PathCostWeights): ChildPairEval {

    const unitA = sqrt(tree1.roundSalience);
    const unitB = sqrt(tree2.roundSalience);
    const gA = segGraphOf(tree1);
    const gB = segGraphOf(tree2);
    const aniso = (procrustes(tree1.pss).anisotropy +
        procrustes(tree2.pss).anisotropy) / 2;
    const root =
        matchSegGraphs(gA, gB, unitA, unitB, weights, aniso).root;

    const a = locate(root, brA, 'a');
    const b = locate(root, brB, 'b');
    if (a === undefined || b === undefined) {
        return {
            ...(a !== undefined ? { a } : {}),
            ...(b !== undefined ? { b } : {}),
            root,
            verdict: 'not pooled children of the winning match (branch ' +
                'lies on a matched route?) - price undeterminable'
        };
    }

    const price = priceChildPair(
        gA, gB, unitA, unitB,
        routeLenOf(a.pair.routeA), routeLenOf(b.pair.routeB),
        weights, weights.sway*aniso, a.child, b.child);
    const dropCost = price.deleteCost + price.insertCost;

    const sameParent = a.pair === b.pair;
    const sameSequence =
        sameParent && seqIdOf(a.child) === seqIdOf(b.child);

    // the sub-DTW's winning route pair (start pinned at the attach vertex)
    const cand = price.dtw.candidates[0];
    const align = alignOfRoutes(
        reverseRoute(routeSegments(price.subA, a.child.attachV, cand.endA)),
        reverseRoute(routeSegments(price.subB, b.child.attachV, cand.endB)),
        unitA, unitB, weights, false);

    const verdict =
        (price.gated
            ? 'drop (terminal↔regular gate: match cost = Infinity)'
            : price.matchCost < dropCost
            ? `match (relabel ${price.matchCost.toFixed(3)} < ` +
                `drop ${dropCost.toFixed(3)})`
            : `drop (relabel ${price.matchCost.toFixed(3)} >= ` +
                `drop ${dropCost.toFixed(3)})`) +
        (!sameParent
            ? ' - HYPOTHETICAL: pooled on different parent pairs, ' +
                'the DP never compares them'
            : !sameSequence
            ? ' - HYPOTHETICAL: different alignment sequences (side/seam), ' +
                'the DP never compares them'
            : ' (in isolation; sequence order can override)');

    return { a, b, sameParent, sameSequence, price, align, verdict, root };
}


/**
 * The per-side alignment sequence the child lands in (mirrors `seqOf`:
 * seam terminals join the out (+1) / back (-1) sequence by seam, not side).
 */
function seqIdOf(c: SegChild): 1 | -1 {
    return c.terminal !== undefined
        ? (c.terminal === 'end' ? 1 : -1)
        : c.side;
}


/**
 * Finds the branch among the winning match's pooled children (all children
 * appear in `ops` as match/delete/insert). Direct hits (the child IS the
 * branch's subtree, or its continuation leftover) win over merely containing
 * subtrees; edge-rooted wins over continuation.
 */
function locate(
        root: SegMatchedPair,
        br: FatBranch,
        key: 'a' | 'b'): ChildLocation | undefined {

    let direct: ChildLocation | undefined;
    let containing: ChildLocation | undefined;

    const visit = (pair: SegMatchedPair): void => {
        for (const op of pair.ops) {
            const c = key === 'a'
                ? (op.type !== 'insert' ? op.a : undefined)
                : (op.type !== 'delete' ? op.b : undefined);
            if (c !== undefined) {
                const role: ChildLocation['role'] =
                    c.edge?.branch === br ? 'edge-rooted'
                    : c.edge === undefined && c.entry.branch === br
                    ? 'continuation'
                    : 'inside subtree';
                const outcome: ChildLocation['outcome'] =
                    op.type === 'match'
                        ? { type: 'match',
                            partner: key === 'a' ? op.b : op.a }
                        : { type: op.type };
                const loc: ChildLocation = { child: c, pair, role, outcome };

                if (role === 'edge-rooted') {
                    if (direct?.role !== 'edge-rooted') { direct = loc; }
                } else if (role === 'continuation') {
                    direct ??= loc;
                } else if (containing === undefined &&
                        c.segs.some(s => s.branch === br)) {
                    containing = loc;
                }
            }
            if (op.type === 'match') { visit(op.sub); }
        }
    };
    visit(root);

    return direct ?? containing;
}


export { evalChildPair }
export type { ChildPairEval, ChildLocation }
