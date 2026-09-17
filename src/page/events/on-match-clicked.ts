import type { PageData } from '../page-data.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import type { MatchedPath } from '../../morph/match-paths/matched-path.js';
import { matchPaths } from '../../morph/match-paths/match-paths.js';
import { matchColors } from './match-colors.js';
import { getFatBranchTree, getFattestCpNode, getSkeletonBeziers } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';


function onMatchClicked(
        refPageData: React.RefObject<PageData | null>) {

    //-------------
    // Gather data
    //-------------
    const { props, svgRef1, svgRef2 } = refPageData.current!;
    const { pageState } = props;
    const { deduced, showDelay } = pageState;
    const { mats1, mats2 } = deduced;

    //---------------------
    // Get fat branch tree
    //---------------------
    const fatTree1 = getFatBranchTree(getFattestCpNode(mats1[0].cpNode));
    const fatTree2 = getFatBranchTree(getFattestCpNode(mats2[0].cpNode));
    if (fatTree1 === undefined || fatTree2 === undefined) { return; }

    //-------
    // Match
    //-------
    const { trunk, flipped, cost } = matchPaths(
        fatTree1, fatTree2, { weights: pageState.pathWeights }
    );

    //-------
    // Draw
    //-------
    const g1 = svgRef1.current!.getElementsByTagName('g')[0];
    const g2 = svgRef2.current!.getElementsByTagName('g')[0];

    // Same DFS preorder as buildMorphEntries - colors match the morph view.
    const painted1 = new Set<FatBranch>();
    const painted2 = new Set<FatBranch>();

    const { pairIdx, insCount, delCount } = walk(
        trunk, painted1, painted2, g1, g2, showDelay
    );


    // Everything no matched path touched (unmatched subtrees, stub
    // sub-branches) retracts/grows - red/green like the morph view.

    sweep(fatTree1, g1, painted1, 'red', showDelay);
    sweep(fatTree2, g2, painted2, 'green', showDelay);

    console.log(
        `matched ${pairIdx} path pairs,`,
        `${delCount} deleted, ${insCount} inserted subtrees,`,
        `flipped ${flipped}, cost ${cost.toFixed(3)}`
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
        showDelay: number,
        pairIdx0 = 0) {

    const color = matchColors[pairIdx0 % matchColors.length];
    for (const p of mp.piecesA) {
        painted1.add(p.branch);
        drawFatBranchPiece(g1, p, color, showDelay);
        drawStubs(g1, p, 'red', showDelay);
    }
    for (const p of mp.piecesB) {
        painted2.add(p.branch);
        drawFatBranchPiece(g2, p, color, showDelay);
        drawStubs(g2, p, 'green', showDelay);
    }

    let pairIdx = pairIdx0 + 1;
    let delCount = 0;
    let insCount = 0;
    for (const op of mp.children) {
        if (op.type === 'match') {
            const r = walk(
                op.sub, painted1, painted2, g1, g2, showDelay, pairIdx);
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
        color: string,
        showDelay: number) {

    if (!painted.has(br)) { drawFatBranch(g, br, color, showDelay); }
    for (const e of br.children ?? []) {
        sweep(e.branch, g, painted, color, showDelay);
    }
}


/**
 * Draws the piece's UNCOVERED slices (the bypassed leaf-side stub of a
 * partially absorbed branch, or a rerouted trunk's tip stretches) - they
 * retract during the morph, so they get the unmatched color.
 */
function drawStubs(
        g: SVGGElement,
        piece: { branch: FatBranch; fromEdge: number; toEdge: number },
        color: string,
        showDelay: number): void {

    const len = getSkeletonBeziers(piece.branch).length;
    if (piece.fromEdge > 0) {
        drawFatBranchPiece(g, {
            branch: piece.branch, fromEdge: 0,
            toEdge: piece.fromEdge
        }, color, showDelay);
    }
    if (piece.toEdge < len) {
        drawFatBranchPiece(g, {
            branch: piece.branch, fromEdge: piece.toEdge,
            toEdge: len
        }, color, showDelay);
    }
}


/**
 * Draws a branch's full skeleton in the given color (removed again after
 * `showDelay` ms if set).
 */
function drawFatBranch(
        g: SVGGElement,
        branch: FatBranch,
        color: string,
        showDelay?: number) {

    const [$medial] = drawBeziersAsSinglePath(
        g, getSkeletonBeziers(branch), `thin10 ${color} nofill`
    );
    if (showDelay && $medial !== undefined) {
        setTimeout(() => $medial.remove(), showDelay);
    }
}


/**
 * Draws only the piece's covered skeleton slice (a rerouted trunk's
 * bypassed stub is NOT part of the path).
 */
function drawFatBranchPiece(
        g: SVGGElement,
        branchPiece: { branch: FatBranch; fromEdge: number; toEdge: number },
        color: string,
        showDelay?: number) {

    const bz = getSkeletonBeziers(branchPiece.branch)
        .slice(branchPiece.fromEdge, branchPiece.toEdge);

    const [$medial] = drawBeziersAsSinglePath(
        g, bz, `thin20 ${color} nofill`
    );

    if (showDelay && $medial !== undefined) {
        setTimeout(() => $medial.remove(), showDelay);
    }
}


export { onMatchClicked }
