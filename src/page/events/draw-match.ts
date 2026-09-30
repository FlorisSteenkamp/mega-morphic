declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PageData } from '../page-data.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import type { MatchedPath } from '../../morph/match-paths/matched-path.js';
import type { Segment } from '../../morph/segment-graph/segment.js';
import { matchColors } from './match-colors.js';
import { coveredSegsOf, branchSegsOf } from '../../morph/build-morph-entries/build-morph-entries.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';


/** overlay option for the current showMatch call (UI module state) */
let withBoundary = false;


/**
 * Shows/hides the match overlay of the LAST match built by the morph
 * button - no matching is performed here, the result is read from
 * `_debug_.elems` (pushed by `buildMorphEntries`).
 */
function drawMatch(
        refPageData: React.RefObject<PageData | null>,
        show: boolean,
        showBoundary = false): void {

    withBoundary = showBoundary;

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

    // A route's bypassed segments may be COVERED by another matched pair
    // (fork-terminated trunks + matched terminals share branches) - only
    // truly uncovered segments are stubs.
    const covered1 = coveredSegsOf(pm.trunk, 'a');
    const covered2 = coveredSegsOf(pm.trunk, 'b');
    const segsOf1 = branchSegsOf(pm.gA);
    const segsOf2 = branchSegsOf(pm.gB);

    const { pairIdx, insCount, delCount } = walk(
        pm.trunk, painted1, painted2, g1, g2,
        covered1, covered2, segsOf1, segsOf2
    );

    // Everything no matched path touched (unmatched subtrees, stub
    // sub-branches) retracts/grows - red/green like the morph view.
    sweep(trees.tree1, g1, painted1, 'red', segsOf1);
    sweep(trees.tree2, g2, painted2, 'green', segsOf2);

    console.log(
        `matched ${pairIdx} path pairs,`,
        `${delCount} deleted, ${insCount} inserted subtrees,`,
        `flipped ${pm.flipped}, cost ${pm.cost.toFixed(3)}`
    );
}


/**
 * Draws a matched path pair's covered route segments in the pair's color
 * (bypassed uncovered segments in red/green) on both svgs, then recurses
 * into the matched child pairs - the same DFS preorder as
 * `buildMorphEntries`, so colors line up with the morph view. Painted
 * branches are recorded for the unmatched sweep. `pairIdx0` is this pair's
 * preorder index; returns the accumulated next pair index and
 * delete/insert counts.
 */
function walk(
        mp: MatchedPath,
        painted1: Set<FatBranch>,
        painted2: Set<FatBranch>,
        g1: SVGGElement,
        g2: SVGGElement,
        covered1: Set<Segment>,
        covered2: Set<Segment>,
        segsOf1: Map<FatBranch, Segment[]>,
        segsOf2: Map<FatBranch, Segment[]>,
        pairIdx0 = 0) {

    const color = matchColors[pairIdx0 % matchColors.length];
    for (const st of mp.routeA) {
        painted1.add(st.seg.branch);
        drawSegment(g1, st.seg, color, 'thin20');
    }
    for (const st of mp.routeB) {
        painted2.add(st.seg.branch);
        drawSegment(g2, st.seg, color, 'thin20');
    }
    for (const br of new Set(mp.routeA.map(st => st.seg.branch))) {
        drawStubs(g1, br, 'red', covered1, segsOf1);
    }
    for (const br of new Set(mp.routeB.map(st => st.seg.branch))) {
        drawStubs(g2, br, 'green', covered2, segsOf2);
    }

    let pairIdx = pairIdx0 + 1;
    let delCount = 0;
    let insCount = 0;
    for (const op of mp.children) {
        if (op.type === 'match') {
            const r = walk(
                op.sub, painted1, painted2, g1, g2,
                covered1, covered2, segsOf1, segsOf2, pairIdx);
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
        segsOf: Map<FatBranch, Segment[]>) {

    if (!painted.has(br)) {
        for (const seg of segsOf.get(br) ?? []) {
            drawSegment(g, seg, color, 'thin10');
        }
    }
    for (const e of br.children) {
        sweep(e.branch, g, painted, color, segsOf);
    }
}


/**
 * Draws the branch's UNCOVERED segments (bypassed stub stretches) -
 * segments another matched pair covers are ITS material and get ITS color,
 * so only segments no pair covers are drawn as stubs.
 */
function drawStubs(
        g: SVGGElement,
        branch: FatBranch,
        color: string,
        covered: Set<Segment>,
        segsOf: Map<FatBranch, Segment[]>): void {

    for (const seg of segsOf.get(branch) ?? []) {
        if (covered.has(seg)) { continue; }
        drawSegment(g, seg, color, 'thin20');
    }
}


/**
 * Draws one segment's skeleton (persistent, tagged `match-viz` for removal
 * on hide) plus its boundary sleeves when the boundary option is on.
 */
function drawSegment(
        g: SVGGElement,
        seg: Segment,
        color: string,
        thin: 'thin10' | 'thin20') {

    drawBeziersAsSinglePath(
        g, seg.pss, `${thin} ${color} nofill match-viz`);

    if (!withBoundary) { return; }
    for (const { out, back } of seg.sleeves) {
        if (out.length > 0) {
            drawBeziersAsSinglePath(
                g, out, `thin10 ${color} nofill match-viz`);
        }
        if (back.length > 0) {
            drawBeziersAsSinglePath(
                g, back, `thin10 ${color} nofill match-viz`);
        }
    }
}


export { drawMatch }
