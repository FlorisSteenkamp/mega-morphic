import type { PageData } from '../page-data.js';
import type { FatBranch } from '../../morph/fat-branch.js';
import { matchTrees } from '../../morph/match-trees/match-trees.js';
import { matchColors } from './match-colors.js';
import { getFatBranchTree } from '../../morph/get-fat-branch-tree.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';


function drawFatBranch(
        g: SVGGElement,
        branch: FatBranch,
        color: string,
        showDelay?: number) {

    const [$path] = drawBeziersAsSinglePath(g, branch.pss, `thin20 ${color} fill25`);
    if ($path !== undefined && showDelay) {
        setTimeout(() => $path.remove(), showDelay);
    }
}


function onMatchClicked(
        refPageData: React.RefObject<PageData | null>) {

    const { props, svgRef1, svgRef2 } = refPageData.current!;
    const { pageState } = props;
    const { deduced } = pageState;
    const { mats1, mats2 } = deduced;

    const fatTree1 = getFatBranchTree(mats1[0].cpNode);
    const fatTree2 = getFatBranchTree(mats2[0].cpNode);
    if (fatTree1 === undefined || fatTree2 === undefined) { return; }

    const r = matchTrees(fatTree1, fatTree2);

    const g1 = svgRef1.current!.getElementsByTagName('g')[0];
    const g2 = svgRef2.current!.getElementsByTagName('g')[0];
    const { showDelay } = pageState;

    r.pairs.forEach(([a, b], i) => {
        const color = matchColors[i % matchColors.length];
        drawFatBranch(g1, a, color, showDelay);
        drawFatBranch(g2, b, color, showDelay);
    });

    console.log(
        `matched ${r.pairs.length} pairs,`,
        `${r.deleted.length} deleted, ${r.inserted.length} inserted,`,
        `cost ${r.cost}, flipped ${r.flipped}`
    );
}


export { onMatchClicked }
