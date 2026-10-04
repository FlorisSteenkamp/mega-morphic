import type { PageData } from '../page-data.js';
import type { SegGraph } from '../../morph/segment-graph/seg-graph.js';
import { segGraphFromCp } from '../../morph/segment-graph/seg-graph-from-mat.js';
import { XMLNS } from '../../draw/xmlns.js';


/**
 * Shows/hides the segment-graph VERTEX ids of the loaded shapes - the same
 * ids every matcher debug output references (needle-window child labels,
 * route dumps, trunk-candidate tables). `segGraphFromMat` is deterministic
 * from `mats[0].cpNode`, so the ids match the production match exactly.
 * Leaves black, forks dark red.
 */
function showVertexNums(
        refPageData: React.RefObject<PageData | null>,
        show: boolean): void {

    const { props, svgRef1, svgRef2 } = refPageData.current!;
    const g1 = svgRef1.current?.getElementsByTagName('g')[0];
    const g2 = svgRef2.current?.getElementsByTagName('g')[0];
    if (g1 === undefined || g2 === undefined) { return; }

    g1.querySelectorAll('.branch-num').forEach($ => $.remove());
    g2.querySelectorAll('.branch-num').forEach($ => $.remove());

    if (!show) { return; }

    const { mats1, mats2 } = props.pageState.deduced;
    if (mats1.length === 0 || mats2.length === 0) { return; }

    drawNums(g1, segGraphFromCp(mats1[0].cpNode));
    drawNums(g2, segGraphFromCp(mats2[0].cpNode));
}


/** Labels every graph vertex with its id (leaves nudged past the tip). */
function drawNums(g: SVGGElement, graph: SegGraph): void {
    // SVG font-size percentages are CSS-relative (inherited font), NOT
    // viewport-relative like stroke-width % - so compute user units per
    // screen px from the CTM (letterbox-safe) for ~16px on screen.
    const ctm = g.ownerSVGElement?.getScreenCTM();
    const pxPerUnit = ctm === null || ctm === undefined
        ? 1 : Math.hypot(ctm.a, ctm.b);
    const fontSize = 12 / pxPerUnit;

    for (const v of graph.vertices) {
        const inc = graph.segments.filter(
            s => s.vertIdS === v.id || s.vertIdE === v.id);
        const leaf = inc.length === 1;

        let p = v.p;
        if (leaf) {
            // nudge PAST the tip (opposite the inward tangent) so the
            // number sits clear of the skeleton
            const s = inc[0];
            const ps = s.vertIdS === v.id
                ? s.skelPss[0]
                : s.skelPss[s.skelPss.length - 1].toReversed();
            const d = tipTangent(ps);
            const off = fontSize * 0.5;
            p = [v.p[0] - off*d[0], v.p[1] - off*d[1]];
        }

        label(g, p, v.id, fontSize, leaf ? '#000000' : '#8b0000');
    }
}


function label(
        g: SVGGElement,
        p: number[],
        i: number,
        fontSize: number,
        color: string): void {

    const $t = document.createElementNS(XMLNS, 'text');
    $t.setAttributeNS(null, 'x', `${p[0]}`);
    $t.setAttributeNS(null, 'y', `${p[1]}`);
    $t.setAttributeNS(null, 'class', 'branch-num');
    // Counter-flip about the label's own y (the parent g is y-flipped).
    $t.setAttributeNS(null, 'transform', `matrix(1 0 0 -1 0 ${2*p[1]})`);
    // White casing keeps the number readable on any overlay.
    $t.setAttributeNS(null, 'style',
        `font-size: ${fontSize}px; fill: ${color}; stroke: #fff; ` +
        `stroke-width: ${fontSize / 8}px; ` +
        'paint-order: stroke; font-weight: 700; user-select: none; ' +
        'text-anchor: middle; dominant-baseline: central;');
    $t.textContent = `${i}`;
    g.appendChild($t);
}


/** Unit tangent at the bezier's start (zero vector when degenerate). */
function tipTangent(ps: number[][]): number[] {
    const p0 = ps[0];
    for (let k = 1; k < ps.length; k++) {
        const dx = ps[k][0] - p0[0];
        const dy = ps[k][1] - p0[1];
        const l = Math.hypot(dx, dy);
        if (l > 0) { return [dx / l, dy / l]; }
    }
    return [0, 0];
}


export { showVertexNums }
