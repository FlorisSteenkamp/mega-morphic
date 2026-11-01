import type { PageData } from '../page-data.js';
import { matchGlyphHoles } from '../../morph/holes/match-holes.js';
import { getMatchColor } from './match-colors.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { clearOverlay } from './clear-overlay.js';


/**
 * Shows/hides the hole match overlay on svgs 1 and 2: matched holes in the
 * same color on both glyphs, holes without a partner red (A) / green (B).
 *
 * * the holes are matched here, from the current MATs (`matchGlyphHoles`) -
 *   the morph doesn't use the hole match (yet)
 *
 * * the costs are logged
 */
function drawMatchHoles(
        refPageData: React.RefObject<PageData | null>,
        show: boolean): void {

    const pageData = refPageData.current!;
    const gs = clearOverlay(pageData, 'match-holes-viz');
    if (gs === undefined) { return; }
    const [g1, g2] = gs;

    if (!show) { return; }

    const { mats1, mats2 } =
        pageData.props.stateControl.state.appState.pageState.deduced;

    const holeMatches = matchGlyphHoles(
        mats1.map(m => m.cpNode), mats2.map(m => m.cpNode));

    let color = 0;
    for (const hm of holeMatches) {
        const { compA, compB, loopsA, loopsB, costs, dropsA, dropsB, match } = hm;
        const { pairs, onlyA, onlyB } = match;

        for (const [i, j] of pairs) {
            const cls = getMatchColor(++color);
            drawHole(g1, loopsA.holes[i], cls);
            drawHole(g2, loopsB.holes[j], cls);
        }
        for (const i of onlyA) { drawHole(g1, loopsA.holes[i], 'red'); }
        for (const j of onlyB) { drawHole(g2, loopsB.holes[j], 'green'); }

        if (loopsA.holes.length + loopsB.holes.length === 0) { continue; }
        console.group(`components ${compA} ↔ ${compB}`);
        console.log(`${loopsA.holes.length} ↔ ${loopsB.holes.length} holes`);
        console.log(`pairs ${pairs.map(([i, j]) =>
            `${i}↔${j} (${costs[i][j].toFixed(3)})`).join(', ') || '-'}`);
        console.log('pair costs', costs.map(row => row.map(c => +c.toFixed(3))));
        console.log(
            'drop costs A', dropsA.map(c => +c.toFixed(3)),
            'B', dropsB.map(c => +c.toFixed(3))
        );
        console.groupEnd();
    }
}


/**
 * Draws one hole's loop (persistent, tagged `match-holes-viz` for removal
 * on hide).
 */
function drawHole(
        g: SVGGElement,
        loop: number[][][],
        color: string) {

    drawBeziersAsSinglePath(
        g, loop, `thin50 ${color} nofill match-holes-viz`);
}


export { drawMatchHoles }
