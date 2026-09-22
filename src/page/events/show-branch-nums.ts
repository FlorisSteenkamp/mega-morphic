declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PageData } from '../page-data.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import { getSkeletonBeziers } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { XMLNS } from '../../draw/xmlns.js';


/**
 * Shows/hides the branch indices of the LAST morph's fat branch trees
 * (DFS preorder from the trunk = 0) at each branch's skeleton midpoint.
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


/** Labels every branch with its DFS preorder index (trunk = 0). */
function drawNums(g: SVGGElement, root: FatBranch): void {
    let i = 0;
    const walk = (br: FatBranch): void => {
        label(g, br, i++);
        for (const e of br.children) { walk(e.branch); }
    };
    walk(root);
}


function label(g: SVGGElement, branch: FatBranch, i: number): void {
    const bz = getSkeletonBeziers(branch);
    if (bz.length === 0) { return; }
    const p = bz[Math.floor(bz.length / 2)][0];

    const $t = document.createElementNS(XMLNS, 'text');
    $t.setAttributeNS(null, 'x', `${p[0]}`);
    $t.setAttributeNS(null, 'y', `${p[1]}`);
    $t.setAttributeNS(null, 'class', 'branch-num');
    // White casing keeps the number readable on any overlay.
    $t.setAttributeNS(null, 'style',
        'font-size: 48px; fill: #7b1fa2; stroke: #fff; stroke-width: 6px; ' +
        'paint-order: stroke; font-weight: 700; user-select: none;');
    $t.textContent = `${i}`;
    g.appendChild($t);
}


export { showBranchNums }
