import type { PageData } from '../page-data.js';
import { getLargestVertex } from 'flo-mat';
import { getBranchTree } from '../../morph/branch-tree/get-branch-tree.js';
import { matchTrees } from '../../morph/match-trees/match-trees-old.js';
import { procrustes } from '../../morph/procrustes-analysis.js';
import { drawBranchTree } from '../../draw-elem/draw-branch-tree.js';
import { matchColors } from './match-colors.js';


function onMatchClickedOld(
        refPageData: React.RefObject<PageData | null>) {

    const { props, svgRef1, svgRef2 } = refPageData.current!;
    const { pageState } = props;
    const { deduced } = pageState;
    const { mats1, mats2, bezierLoops1, bezierLoops2 } = deduced;

    const cpNode1 = getLargestVertex(mats1[0].cpNode);
    const cpNode2 = getLargestVertex(mats2[0].cpNode);

    const tree1 = getBranchTree(cpNode1);
    const tree2 = getBranchTree(cpNode2);

    const pose1 = procrustes(bezierLoops1[0], mats1);
    const pose2 = procrustes(bezierLoops2[0], mats2);

    // const r = matchTrees(tree1, tree2, { pose1, pose2 });
    const r = matchTrees(tree1, tree2);

    const g1 = svgRef1.current!.getElementsByTagName('g')[0];
    const g2 = svgRef2.current!.getElementsByTagName('g')[0];
    const { showDelay } = pageState;

    r.pairs.forEach(([a, b], i) => {
        const classes = `${matchColors[i % matchColors.length]} thin35 nofill`;
        drawBranchTree(g1, a, classes, showDelay);
        drawBranchTree(g2, b, classes, showDelay);
    });
}


export { onMatchClickedOld }
