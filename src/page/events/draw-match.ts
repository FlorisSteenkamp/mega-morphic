declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PageData } from '../page-data.js';
import type { SegMatchedPair } from '../../morph/segment-tree/match-seg-trees.js';
import type { Segment } from '../../morph/segment-tree/segment.js';
import { matchColors } from './match-colors.js';
import { coveredSegsOf } from '../../morph/build-morph-entries/build-morph-entries.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';


/** overlay option for the current drawMatch call (UI module state) */
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
    if (pm === undefined) {
        console.log('no match available yet - click morph first');
        return;
    }

    const covered1 = coveredSegsOf(pm.trunk, 'a');
    const covered2 = coveredSegsOf(pm.trunk, 'b');

    // Same DFS preorder as buildMorphEntries - colors match the morph view.
    const { pairIdx, insCount, delCount } = walk(pm.trunk, g1, g2);

    // Everything no matched route covers retracts/grows - red/green like
    // the morph view.
    for (const seg of pm.gA) {
        if (!covered1.has(seg)) { drawSegment(g1, seg, 'red'); }
    }
    for (const seg of pm.gB) {
        if (!covered2.has(seg)) { drawSegment(g2, seg, 'green'); }
    }

    console.log(
        `matched ${pairIdx} route pairs,`,
        `${delCount} deleted, ${insCount} inserted subtrees,`,
        `cost ${pm.cost.toFixed(3)}`
    );
}


/**
 * Draws a matched route pair's covered segments in the pair's color on
 * both svgs, then recurses into the matched child pairs - the same DFS
 * preorder as `buildMorphEntries`, so colors line up with the morph view.
 * `pairIdx0` is this pair's preorder index; returns the accumulated next
 * pair index and delete/insert counts.
 */
function walk(
        mp: SegMatchedPair,
        g1: SVGGElement,
        g2: SVGGElement,
        pairIdx0 = 0) {

    const color = matchColors[pairIdx0 % matchColors.length];
    for (const st of mp.routeA) {
        drawSegment(g1, st.seg, color);
    }
    for (const st of mp.routeB) {
        drawSegment(g2, st.seg, color);
    }

    let pairIdx = pairIdx0 + 1;
    let delCount = 0;
    let insCount = 0;
    for (const op of mp.ops) {
        if (op.type === 'match') {
            const r = walk(op.sub, g1, g2, pairIdx);
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
 * Draws one segment's skeleton (persistent, tagged `match-viz` for removal
 * on hide) plus its boundary sleeves when the boundary option is on.
 */
function drawSegment(
        g: SVGGElement,
        seg: Segment,
        color: string) {

    drawBeziersAsSinglePath(
        g, seg.skelPss, `thin20 ${color} nofill match-viz`);

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
