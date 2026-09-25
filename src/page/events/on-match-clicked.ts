declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PageData } from '../page-data.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import type { MatchedPath } from '../../morph/match-paths/matched-path.js';
import { matchColors } from './match-colors.js';
import { getSkeletonBeziers } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { coveredEdgesOf } from '../../morph/build-morph-entries/build-morph-entries.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';


/**
 * Shows/hides the match overlay of the LAST match built by the morph
 * button - no matching is performed here, the result is read from
 * `_debug_.elems` (pushed by `buildMorphEntries`).
 */
function showMatch(
        refPageData: React.RefObject<PageData | null>,
        show: boolean): void {

    const { svgRef1, svgRef2 } = refPageData.current!;
    const g1 = svgRef1.current?.getElementsByTagName('g')[0];
    const g2 = svgRef2.current?.getElementsByTagName('g')[0];
    if (g1 === undefined || g2 === undefined) { return; }

    g1.querySelectorAll('.match-viz').forEach($ => $.remove());
    g2.querySelectorAll('.match-viz').forEach($ => $.remove());

    if (!show || typeof _debug_ === 'undefined') { return; }

    const pm = _debug_.elems.pathMatchResult.at(-1);
    const trees = _debug_.elems.matchTrees.at(-1);
    if (pm === undefined || trees === undefined) {
        console.log('no match available yet - click morph first');
        return;
    }

    // Same DFS preorder as buildMorphEntries - colors match the morph view.
    const painted1 = new Set<FatBranch>();
    const painted2 = new Set<FatBranch>();

    // A piece's bypassed slices may be COVERED by another matched pair
    // (fork-terminated trunks + matched terminals share branches) - only
    // truly uncovered slices are stubs.
    const covered1 = coveredEdgesOf(pm.trunk, 'a');
    const covered2 = coveredEdgesOf(pm.trunk, 'b');

    const { pairIdx, insCount, delCount } = walk(
        pm.trunk, painted1, painted2, g1, g2, covered1, covered2
    );

    // Everything no matched path touched (unmatched subtrees, stub
    // sub-branches) retracts/grows - red/green like the morph view.
    sweep(trees.tree1, g1, painted1, 'red');
    sweep(trees.tree2, g2, painted2, 'green');

    console.log(
        `matched ${pairIdx} path pairs,`,
        `${delCount} deleted, ${insCount} inserted subtrees,`,
        `flipped ${pm.flipped}, cost ${pm.cost.toFixed(3)}`
    );
}


/**
 * Draws a matched path pair's covered skeleton pieces in the pair's color
 * (bypassed stub slices in red/green) on both svgs, then recurses into the
 * matched child pairs - the same DFS preorder as `buildMorphEntries`, so
 * colors line up with the morph view. Painted branches are recorded for the
 * unmatched sweep. `pairIdx0` is this pair's preorder index; returns the
 * accumulated next pair index and delete/insert counts.
 */
function walk(
        mp: MatchedPath,
        painted1: Set<FatBranch>,
        painted2: Set<FatBranch>,
        g1: SVGGElement,
        g2: SVGGElement,
        covered1: Map<FatBranch, Set<number>>,
        covered2: Map<FatBranch, Set<number>>,
        pairIdx0 = 0) {

    const color = matchColors[pairIdx0 % matchColors.length];
    for (const p of mp.piecesA) {
        painted1.add(p.branch);
        drawFatBranchPiece(g1, p, color);
        drawStubs(g1, p, 'red', covered1);
    }
    for (const p of mp.piecesB) {
        painted2.add(p.branch);
        drawFatBranchPiece(g2, p, color);
        drawStubs(g2, p, 'green', covered2);
    }

    let pairIdx = pairIdx0 + 1;
    let delCount = 0;
    let insCount = 0;
    for (const op of mp.children) {
        if (op.type === 'match') {
            const r = walk(
                op.sub, painted1, painted2, g1, g2,
                covered1, covered2, pairIdx);
            pairIdx = r.pairIdx;
            delCount += r.delCount;
            insCount += r.insCount;
        }
        else if (op.type === 'delete') {
            delCount++;
        } else {
            insCount++;
        }
    }

    return { pairIdx, insCount, delCount };
}


/**
 * Draws every branch of the tree that no matched path touched (unmatched
 * subtrees, sub-branches hanging off bypassed stubs) - this material
 * retracts/grows during the morph.
 */
function sweep(
        br: FatBranch,
        g: SVGGElement,
        painted: Set<FatBranch>,
        color: string) {

    if (!painted.has(br)) { drawFatBranch(g, br, color); }
    for (const e of br.children) {
        sweep(e.branch, g, painted, color);
    }
}


/**
 * Draws the piece's UNCOVERED slices (bypassed stub stretches) - slices
 * another matched pair covers are ITS material and get ITS color, so only
 * contiguous runs of edges no pair covers are drawn as stubs.
 */
function drawStubs(
        g: SVGGElement,
        piece: { branch: FatBranch; fromEdge: number; toEdge: number },
        color: string,
        covered: Map<FatBranch, Set<number>>): void {

    const len = getSkeletonBeziers(piece.branch).length;
    const cov = covered.get(piece.branch);

    const drawUncoveredRuns = (from: number, to: number): void => {
        let runStart = -1;
        for (let e = from; e <= to; e++) {
            const isCov = e >= to || cov?.has(e) === true;
            if (!isCov && runStart < 0) { runStart = e; }
            if (isCov && runStart >= 0) {
                drawFatBranchPiece(g, {
                    branch: piece.branch, fromEdge: runStart, toEdge: e
                }, color);
                runStart = -1;
            }
        }
    };

    drawUncoveredRuns(0, piece.fromEdge);
    drawUncoveredRuns(piece.toEdge, len);
}


/**
 * Draws a branch's full skeleton in the given color (persistent, tagged
 * `match-viz` for removal on hide).
 */
function drawFatBranch(
        g: SVGGElement,
        branch: FatBranch,
        color: string) {

    drawBeziersAsSinglePath(
        g, getSkeletonBeziers(branch), `thin10 ${color} nofill match-viz`
    );
}


/**
 * Draws only the piece's covered skeleton slice (a rerouted trunk's
 * bypassed stub is NOT part of the path).
 */
function drawFatBranchPiece(
        g: SVGGElement,
        branchPiece: { branch: FatBranch; fromEdge: number; toEdge: number },
        color: string) {

    const bz = getSkeletonBeziers(branchPiece.branch)
        .slice(branchPiece.fromEdge, branchPiece.toEdge);

    drawBeziersAsSinglePath(g, bz, `thin20 ${color} nofill match-viz`);
}


export { showMatch }
