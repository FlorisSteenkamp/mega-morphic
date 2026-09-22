declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PageData } from '../page-data.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import { getSkeletonBeziers } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { XMLNS } from '../../draw/xmlns.js';


/**
 * Shows/hides the branch indices of the LAST morph's fat branch trees
 * (BFS level order, trunk skipped, first trunk child = 0) at each
 * branch's leaf tip, colored by depth.
 */
function showBranchNums(
        refPageData: React.RefObject<PageData | null>,
        show: boolean): void {

    const { svgRef1, svgRef2 } = refPageData.current!;
    const g1 = svgRef1.current?.getElementsByTagName('g')[0];
    const g2 = svgRef2.current?.getElementsByTagName('g')[0];
    if (g1 === undefined || g2 === undefined) { return; }

    g1.querySelectorAll('.branch-num').forEach($ => $.remove());
    g2.querySelectorAll('.branch-num').forEach($ => $.remove());

    if (!show || typeof _debug_ === 'undefined') { return; }

    const trees = _debug_.elems.matchTrees.at(-1);
    if (trees === undefined) {
        console.log('no trees available yet - click morph first');
        return;
    }

    drawNums(g1, trees.tree1);
    drawNums(g2, trees.tree2);
}


/** Label fill per tree depth, starting at the trunk's DIRECT children
 *  (the trunk itself is not labeled); cycles when deeper. */
const levelColors = [
    '#000000',  // level 1: black
    '#000080',  // navy
    '#006400',  // dark green
    '#8b0000',  // dark red
    '#6a0dad',  // purple
    '#00695c'   // teal
];


/** Labels every branch below the trunk with its BFS (level-order) index
 *  (first trunk child = 0; the trunk itself is skipped). */
function drawNums(g: SVGGElement, root: FatBranch): void {
    // SVG font-size percentages are CSS-relative (inherited font), NOT
    // viewport-relative like stroke-width % - so compute user units per
    // screen px from the CTM (letterbox-safe) for ~16px on screen.
    const ctm = g.ownerSVGElement?.getScreenCTM();
    const pxPerUnit = ctm === null || ctm === undefined
        ? 1 : Math.hypot(ctm.a, ctm.b);
    const fontSize = 12 / pxPerUnit;

    // BFS: single digits = shallow, big numbers = deep.
    let i = 0;
    const queue: { br: FatBranch; depth: number }[] =
        root.children.map(e => ({ br: e.branch, depth: 0 }));
    while (queue.length > 0) {
        const { br, depth } = queue.shift()!;
        const color = levelColors[depth % levelColors.length];
        label(g, br, i++, fontSize, color);
        for (const e of br.children) {
            queue.push({ br: e.branch, depth: depth + 1 });
        }
    }

    // DFS preorder alternative (matches console children-array walks):
    // let i = 0;
    // const walk = (br: FatBranch, depth: number): void => {
    //     label(g, br, i++, fontSize,
    //         levelColors[depth % levelColors.length]);
    //     for (const e of br.children) { walk(e.branch, depth + 1); }
    // };
    // for (const e of root.children) { walk(e.branch, 0); }
}


function label(
        g: SVGGElement,
        branch: FatBranch,
        i: number,
        fontSize: number,
        color: string): void {

    const bz = getSkeletonBeziers(branch);
    if (bz.length === 0) { return; }
    // Skeleton beziers run leaf tip -> other end; nudge PAST the tip
    // (opposite the inward tangent) so the number sits clear of the branch.
    const p0 = bz[0][0];
    const d = tipTangent(bz[0]);
    const off = fontSize * 0.5;
    const p = [p0[0] - off*d[0], p0[1] - off*d[1]];

    const $t = document.createElementNS(XMLNS, 'text');
    $t.setAttributeNS(null, 'x', `${p[0]}`);
    $t.setAttributeNS(null, 'y', `${p[1]}`);
    $t.setAttributeNS(null, 'class', 'branch-num');
    // White casing keeps the number readable on any overlay.
    $t.setAttributeNS(null, 'style',
        `font-size: ${fontSize}px; fill: ${color}; stroke: #fff; ` +
        `stroke-width: ${fontSize / 8}px; ` +
        'paint-order: stroke; font-weight: 700; user-select: none; ' +
        'text-anchor: middle; dominant-baseline: central;');
    $t.textContent = `${i}`;
    g.appendChild($t);
}


/** Unit tangent at the segment's start (zero vector when degenerate). */
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


/** BFS (level-order) index per branch, trunk skipped - the SAME numbering
 *  the on-svg "branch #s" overlay shows. */
function bfsBranchIndices(root: FatBranch): Map<FatBranch, number> {
    const out = new Map<FatBranch, number>();
    let i = 0;
    const queue: FatBranch[] = root.children.map(e => e.branch);
    while (queue.length > 0) {
        const br = queue.shift()!;
        out.set(br, i++);
        for (const e of br.children) { queue.push(e.branch); }
    }
    return out;
}


export { showBranchNums, bfsBranchIndices }
