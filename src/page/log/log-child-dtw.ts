declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { FatBranch, FatBranchEdge } from '../../morph/fat-branch/fat-branch.js';
import type { PathCostWeights } from '../../morph/match-paths/path-cost-weights.js';
import type { MatchedPath } from '../../morph/match-paths/matched-path.js';
import type { PathChildOp } from '../../morph/match-paths/path-child-op.js';
import { matchPathPair } from '../../morph/match-paths/match-path-pair.js';
import { pathsOf$ } from '../../morph/match-paths/paths-of.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { drawAlignSteps, distToPss, svgGroup } from './align-viz.js';

const { abs, sqrt, PI: π } = Math;


/** Two-click selection state (debug tool - module scope suffices). */
let selA: FatBranch | undefined;
let selB: FatBranch | undefined;


/**
 * Two-click child-pair DTW: a click on svg1/svg2 selects the nearest child
 * branch of that tree; once both sides are selected the pair's cheapest
 * path-pair match is evaluated FRESH with the current weights (whether or
 * not the matcher used it) and its alignment is drawn on both svgs.
 */
function logChildDtw(
        shapeIdx: 1 | 2,
        weights: PathCostWeights) {

    return function(g: SVGGElement, p: number[], showDelay?: number): void {
        if (typeof _debug_ === 'undefined') { return; }
        const trees = _debug_.elems.matchTrees[0];
        if (trees === undefined) {
            console.log('no match trees yet - click morph first');
            return;
        }

        const tree = shapeIdx === 1 ? trees.tree1 : trees.tree2;
        const children = descendantsOf(tree);
        if (children.length === 0) {
            console.log(`tree ${shapeIdx} has no child branches`);
            return;
        }

        let nearest = children[0];
        let bestD = Infinity;
        for (const br of children) {
            const d = distToPss(p, br.pss);
            if (d < bestD) { bestD = d; nearest = br; }
        }

        if (shapeIdx === 1) { selA = nearest; } else { selB = nearest; }
        highlight(g, nearest.pss, shapeIdx === 1 ? 'red' : 'green', showDelay);

        if (selA === undefined || selB === undefined) {
            console.log(`selected a child on svg${shapeIdx} - ` +
                `now click a child on svg${shapeIdx === 1 ? 2 : 1}`);
            return;
        }

        evaluate(trees.tree1, trees.tree2, selA, selB, weights, showDelay);
    };
}


/** Cheapest path-pair match of the two subtrees (unmemoized - weight-live). */
function evaluate(
        tree1: FatBranch,
        tree2: FatBranch,
        brA: FatBranch,
        brB: FatBranch,
        weights: PathCostWeights,
        showDelay?: number): void {

    const matchPathPair_ = matchPathPair(tree1.roundSalience, tree2.roundSalience, weights);

    let best: MatchedPath | undefined;
    for (const pA of pathsOf$(brA)) {
        for (const pB of pathsOf$(brB)) {
            const m = matchPathPair_(pA, pB, false, false);
            if (best === undefined ||
                m.cost.totalCost < best.cost.totalCost) { best = m; }
        }
    }
    if (best === undefined) {
        console.log('no candidate paths for the selected pair');
        return;
    }

    const g1 = svgGroup('svg');
    const g2 = svgGroup('svg2');
    if (g1 === undefined || g2 === undefined) { return; }

    if (best.align === undefined ||
        !drawAlignSteps(g1, g2, best.align, showDelay)) {
        console.log('degenerate alignment (too few samples)', best);
    }

    // The pooled relabel's angle term; its position term is only
    // determinable when both children are pooled on the SAME matched
    // parent path pair of the winning match.
    const eA = edgeOf(tree1, brA);
    const eB = edgeOf(tree2, brB);
    const angleTerm = eA !== undefined && eB !== undefined
        ? weights.angle * angleDist(eA.angle, eB.angle) / π
        : undefined;
    const pooled = pooledInfoOf(tree1, tree2, brA, brB, weights);

    // The two sides of the matcher's decision: MATCH the pair (relabel)
    // vs DROP it (delete a + insert b).
    const relabelCost = angleTerm === undefined ||
        pooled.positionTerm === undefined
        ? undefined : best.cost.totalCost + angleTerm + pooled.positionTerm;
    const deleteCost = weights.delFloor +
        weights.del * brA.roundSalience / tree1.roundSalience;
    const insertCost = weights.delFloor +
        weights.del * brB.roundSalience / tree2.roundSalience;
    const dropCost = deleteCost + insertCost;

    console.log('child pair dtw:', {
        cost: {
            // --- price to MATCH: relabelCost = pairCost + angle + position
            match: {
                /** intrinsic pair cost = shape + tails/stubs + children */
                pairCost: {
                    total: best.cost.totalCost,
                    shapeCost: best.cost.shapeCost,
                    childCost: best.cost.childCost,
                    tailAndStubCost: best.cost.totalCost -
                        (best.cost.shapeCost + best.cost.childCost),
                },
                angleTerm,
                positionTerm: pooled.positionTerm,
                "total relabel cost": relabelCost
            },
            // --- price to DROP: dropCost = deleteCost + insertCost
            drop: {
                deleteCost,
                insertCost,
                "total drop cost": dropCost
            },
            // --- the decision (in isolation; sequence order can override)
            verdict: relabelCost === undefined
                ? 'relabel undetermined (position term needs the winning parent path pair)'
                : relabelCost < dropCost
                ? `match (relabel ${relabelCost.toFixed(3)} < drop ${dropCost.toFixed(3)})`
                : `drop (relabel ${relabelCost.toFixed(3)} >= drop ${dropCost.toFixed(3)})`
        },
        tailA: best.tailA,
        tailB: best.tailB,
        // Sides relative to the winning TRAVERSED paths (the matcher's
        // gate) - these flip with path orientation, unlike the edge sides.
        pooledSideA: pooled.sideA,
        pooledSideB: pooled.sideB,
        edgeSideA: eA?.side,
        edgeSideB: eB?.side,
        // Orientation is decided at trunk level only.
        trunkFlipped: _debug_.elems.pathMatchResult[0]?.flipped,
        childOps: summarize(best.children),
        best
    });
}


/**
 * The pair's pooled-child data from the WINNING match: the position term
 * (only when both are pooled on the same matched parent path pair) and
 * each side's pooled side (relative to the traversed path).
 */
function pooledInfoOf(
        tree1: FatBranch,
        tree2: FatBranch,
        brA: FatBranch,
        brB: FatBranch,
        weights: PathCostWeights): {
        positionTerm?: number; sideA?: 1 | -1; sideB?: 1 | -1 } {

    const pm = _debug_.elems.pathMatchResult[0];
    if (pm === undefined) { return {}; }

    const unit1 = sqrt(tree1.roundSalience);
    const unit2 = sqrt(tree2.roundSalience);

    let positionTerm: number | undefined;
    let sideA: 1 | -1 | undefined;
    let sideB: 1 | -1 | undefined;

    (function walk(mp: MatchedPath): void {
        let dA: number | undefined;
        let dB: number | undefined;
        for (const op of mp.children) {
            if (op.type !== 'insert' && op.a.edge.branch === brA) {
                dA = op.a.dist;
                sideA = op.a.side;
            }
            if (op.type !== 'delete' && op.b.edge.branch === brB) {
                dB = op.b.dist;
                sideB = op.b.side;
            }
            if (op.type === 'match') { walk(op.sub); }
        }
        if (dA !== undefined && dB !== undefined) {
            positionTerm = weights.position * abs(dA/unit1 - dB/unit2);
        }
    })(pm.trunk);

    return { positionTerm, sideA, sideB };
}


/** Op counts of the pair's recursive child alignment. */
function summarize(ops: PathChildOp[]): Record<PathChildOp['type'], number> {
    const out = { match: 0, delete: 0, insert: 0 };
    for (const op of ops) { out[op.type]++; }
    return out;
}


/** All descendant branches of the tree (trunk itself excluded). */
function descendantsOf(root: FatBranch): FatBranch[] {
    const out: FatBranch[] = [];
    const walk = (br: FatBranch): void => {
        for (const e of br.children) {
            out.push(e.branch);
            walk(e.branch);
        }
    };
    walk(root);
    return out;
}


/** The tree edge whose child branch is `br`. */
function edgeOf(root: FatBranch, br: FatBranch): FatBranchEdge | undefined {
    for (const e of root.children) {
        if (e.branch === br) { return e; }
        const found = edgeOf(e.branch, br);
        if (found !== undefined) { return found; }
    }
    return undefined;
}


/** Smallest absolute difference between two angles (in [0, π]). */
function angleDist(x: number, y: number): number {
    const d = abs(x - y) % (2*π);
    return d > π ? 2*π - d : d;
}


function highlight(
        g: SVGGElement,
        pss: number[][][],
        color: string,
        showDelay?: number): void {

    const [$path] = drawBeziersAsSinglePath(g, pss, `thin20 ${color} fill25`);
    if ($path !== undefined && showDelay) {
        setTimeout(() => $path.remove(), showDelay);
    }
}


export { logChildDtw }
