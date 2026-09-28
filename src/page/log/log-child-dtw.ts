declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import type { PathCostWeights } from '../../morph/match-paths/path-cost-weights.js';
import type { MatchedPath } from '../../morph/match-paths/matched-path.js';
import type { PathChildOp } from '../../morph/match-paths/path-child-op.js';
import type { PathPiece } from '../../morph/match-paths/path-piece.js';
import type { ChildLocation } from '../../morph/segment-graph/eval-child-pair.js';
import { evalChildPair } from '../../morph/segment-graph/eval-child-pair.js';
import { getSkeletonBeziers } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { totalLength$ } from '../../morph/fs/total-length.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { drawAlignSteps, distToPss, svgGroup } from './align-viz.js';


/** Two-click selection state (debug tool - module scope suffices). */
let selA: FatBranch | undefined;
let selB: FatBranch | undefined;


/**
 * Two-click child-pair DTW: a click on svg1/svg2 selects the nearest child
 * branch of that tree (or the TRUNK, via its skeleton); once both sides are
 * selected the pair is priced FRESH with the current weights using the
 * SEGMENT matcher's actual economics (`evalChildPair`) and the sub-DTW's
 * alignment is drawn on both svgs. Selecting both trunks shows the WINNING
 * trunk pair instead (actual routes + coverage).
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

        // the trunk competes via its skeleton line (its pss span the
        // whole glyph and would hijack every click)
        let nearest: FatBranch = tree;
        let bestD = distToPss(p, getSkeletonBeziers(tree));
        for (const br of children) {
            const d = distToPss(p, br.pss);
            if (d < bestD) { bestD = d; nearest = br; }
        }

        if (shapeIdx === 1) { selA = nearest; } else { selB = nearest; }
        // detection is skeleton-based for the trunk, but the highlight
        // shows its REGION outline (filling the skeleton is meaningless)
        highlight(g, nearest.pss,
            shapeIdx === 1 ? 'red' : 'green', showDelay);

        if (selA === undefined || selB === undefined) {
            console.log(`selected a ${nearest === tree ? 'TRUNK' : 'child'} ` +
                `on svg${shapeIdx} - ` +
                `now click a branch on svg${shapeIdx === 1 ? 2 : 1}`);
            return;
        }

        if (selA === trees.tree1 && selB === trees.tree2) {
            logTrunkPair(showDelay);
            return;
        }

        evaluate(trees.tree1, trees.tree2, selA, selB, weights, showDelay);
    };
}


/**
 * Shows the WINNING trunk pair: its DTW barber-pole plus a coverage
 * breakdown per piece - uncovered slices are the material that retracts
 * (grow/retract asymmetries live here).
 */
function logTrunkPair(showDelay?: number): void {
    const pm = _debug_.elems.pathMatchResult[0];
    if (pm === undefined) {
        console.log('no match yet - click morph first');
        return;
    }
    const mp = pm.trunk;

    const g1 = svgGroup('svg');
    const g2 = svgGroup('svg2');
    if (g1 === undefined || g2 === undefined) { return; }

    if (mp.align === undefined ||
        !drawAlignSteps(g1, g2, mp.align, showDelay)) {
        console.log('trunk align data unavailable', mp);
    }

    console.log('trunk pair dtw:', {
        cost: {
            total: mp.cost.totalCost,
            shapeCost: mp.cost.shapeCost,
            childCost: mp.cost.childCost
        },
        piecesA: describeCoverage(mp.piecesA),
        piecesB: describeCoverage(mp.piecesB),
        tailA: mp.tailA,
        tailB: mp.tailB,
        // long gap runs collapse material to a point on the other side
        // (grow/retract despite full coverage) - u ranges of runs > 3 samples
        gapRuns: mp.align === undefined ? undefined : gapRuns(mp.align),
        // the DRAWN warp is alignBranches pinned at these anchors - a pair
        // with wildly different u values squeezes the material next to it
        anchors: anchorsOf(mp),
        childOps: summarize(mp.children),
        trunk: mp
    });
}


/** Maximal gap runs (> 3 samples) of the trunk alignment, with u ranges. */
function gapRuns(al: NonNullable<MatchedPath['align']>): string[] {
    const out: string[] = [];
    let runStart = -1;
    let runState: 0 | 1 | 2 = 0;
    const flush = (endIdx: number): void => {
        if (runStart < 0 || endIdx - runStart <= 3) { runStart = -1; return; }
        const s0 = al.steps[runStart];
        const s1 = al.steps[endIdx - 1];
        out.push(runState === 1
            ? `gap in A: uA [${al.usA[s0.i].toFixed(3)}..${
                al.usA[s1.i].toFixed(3)}] maps to uB ~${
                al.usB[s0.j].toFixed(3)} (${endIdx - runStart} samples)`
            : `gap in B: uB [${al.usB[s0.j].toFixed(3)}..${
                al.usB[s1.j].toFixed(3)}] maps to uA ~${
                al.usA[s0.i].toFixed(3)} (${endIdx - runStart} samples)`);
        runStart = -1;
    };
    for (let k = 0; k < al.steps.length; k++) {
        const st = al.steps[k].state;
        if (st !== runState) {
            flush(k);
            if (st !== 0) { runStart = k; runState = st; }
            else { runState = 0; }
        }
    }
    flush(al.steps.length);
    return out;
}


/** The pair's matched child-fork anchors: normalized positions per side. */
function anchorsOf(mp: MatchedPath): string[] {
    const LA = mp.align === undefined
        ? undefined : totalLenOf(mp.align.skelPssA);
    const LB = mp.align === undefined
        ? undefined : totalLenOf(mp.align.skelPssB);
    if (LA === undefined || LB === undefined) { return []; }

    return mp.children
        .filter(op => op.type === 'match')
        .map(op => {
            const o = op as Extract<PathChildOp, { type: 'match' }>;
            const uA = o.a.dist / LA;
            const uB = o.b.dist / LB;
            return `uA ${uA.toFixed(3)} ↔ uB ${uB.toFixed(3)} ` +
                `(Δu ${(uA - uB).toFixed(3)}, side ${o.a.side})`;
        });
}


function totalLenOf(pss: number[][][]): number {
    let L = 0;
    for (const ps of pss) { L += totalLength$(ps); }
    return L;
}


/** Piece slices in travel order, annotating UNCOVERED (retracting) slices. */
function describeCoverage(pieces: PathPiece[]): string[] {
    return pieces.map(p => {
        const len = getSkeletonBeziers(p.branch).length;
        const stubs =
            (p.fromEdge > 0
                ? ` | uncovered [0..${p.fromEdge}) RETRACTS` : '') +
            (p.toEdge < len
                ? ` | uncovered [${p.toEdge}..${len}) RETRACTS` : '');
        return `[${p.fromEdge}..${p.toEdge})${p.reversed ? 'ʳ' : ''}` +
            ` of ${len}${stubs}`;
    });
}


/** Prices the selected pair with the SEGMENT matcher's actual economics. */
function evaluate(
        tree1: FatBranch,
        tree2: FatBranch,
        brA: FatBranch,
        brB: FatBranch,
        weights: PathCostWeights,
        showDelay?: number): void {

    const r = evalChildPair(tree1, tree2, brA, brB, weights);

    if (r.align !== undefined) {
        const g1 = svgGroup('svg');
        const g2 = svgGroup('svg2');
        if (g1 !== undefined && g2 !== undefined &&
            !drawAlignSteps(g1, g2, r.align, showDelay)) {
            console.log('degenerate alignment (too few samples)');
        }
    }

    const price = r.price;
    console.log('child pair dtw:', {
        // the matcher's decision inputs: matchCost vs delCost + insCost
        cost: price === undefined ? undefined : {
            match: {
                // pinned-start sub product-DTW total (coverage-priced)
                dtwCost: price.dtwCost,
                // quadratic in the normalized dist mismatch
                positionCost: price.positionCost,
                angleCost: price.angleCost,
                "total match cost": price.matchCost
            },
            drop: {
                deleteCost: price.deleteCost,
                insertCost: price.insertCost,
                "total drop cost": price.deleteCost + price.insertCost
            }
        },
        verdict: r.verdict,
        selectionA: describeLoc(r.a),
        selectionB: describeLoc(r.b),
        // the DP only ever compares children pooled on the same parent
        // pair AND in the same per-side sequence
        sameParent: r.sameParent,
        sameSequence: r.sameSequence,
        // the fresh winning match (current weights), for digging
        root: r.root
    });
}


/** Human-readable summary of one selection's pooled-child location. */
function describeLoc(loc: ChildLocation | undefined): unknown {
    if (loc === undefined) {
        return 'not a pooled child of the winning match (on a route?)';
    }
    const c = loc.child;
    return {
        role: loc.role,
        side: c.side,
        terminal: c.terminal,
        dist: c.dist,
        angle: c.angle,
        material: c.material,
        // what the winning match actually did with this child
        outcome: loc.outcome.type,
        partner: loc.outcome.partner,
        child: c
    };
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
