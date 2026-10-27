declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PageData } from '../page-data.js';
import { pairsOf } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
import type { Segment } from '../../morph/segment-tree/segment.js';
import { getMatchColor } from './match-colors.js';
import { geomOf$ } from '../../morph/segment-tree/geom-of.js';
import { coveredSegsOf } from '../../morph/build-morph-entries/build-morph-entries.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { clearOverlay } from './clear-overlay.js';


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

    const gs = clearOverlay(refPageData.current!, 'match-viz');
    if (gs === undefined) { return; }
    const [g1, g2] = gs;

    if (!show || typeof _debug_ === 'undefined') { return; }

    const pm = _debug_.elems.pathMatchResult.at(-1);
    if (pm === undefined) {
        console.log('no match available yet - click morph first');
        return;
    }

    const covered1 = coveredSegsOf(pm.trunk, 'a');
    const covered2 = coveredSegsOf(pm.trunk, 'b');

    // Same DFS preorder as buildMorphEntries - colors match the morph view.
    const pairs = pairsOf(pm.trunk);
    for (const { mp, idx } of pairs) {
        const color = getMatchColor(idx);
        for (const st of mp.routeA) { drawSegment(g1, st.seg, color); }
        for (const st of mp.routeB) { drawSegment(g2, st.seg, color); }
    }

    const ops = pairs.flatMap(({ mp }) => mp.ops);
    const delCount = ops.filter(op => op.type === 'delete').length;
    const insCount = ops.filter(op => op.type === 'insert').length;

    // Everything no matched route covers retracts/grows - red/green like
    // the morph view.
    for (const seg of pm.gA) {
        if (!covered1.has(seg)) { drawSegment(g1, seg, 'red'); }
    }
    for (const seg of pm.gB) {
        if (!covered2.has(seg)) { drawSegment(g2, seg, 'green'); }
    }

    console.log(
        `matched ${pairs.length} route pairs,`,
        `${delCount} deleted, ${insCount} inserted subtrees,`,
        `cost ${pm.trunk.cost.toFixed(3)}`
    );
}


/**
 * Draws one segment's skeleton (persistent, tagged `match-viz` for removal
 * on hide) plus its boundary sleeves when the boundary option is on.
 */
function drawSegment(
        g: SVGGElement,
        seg: Segment,
        color: string) {

    const { skelPss, sleeves } = geomOf$(seg);

    drawBeziersAsSinglePath(
        g, skelPss, `thin20 ${color} nofill match-viz`);

    if (!withBoundary) { return; }
    for (const pss of sleeves.flatMap(({ out, back }) => [out, back])) {
        drawBeziersAsSinglePath(g, pss, `thin10 ${color} nofill match-viz`);
    }
}


export { drawMatch }
