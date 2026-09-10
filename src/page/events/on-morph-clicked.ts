import type { PageData } from '../page-data.js';
import { buildMorphEntries } from '../../morph/build-morph-entries.js';
import { drawMorph } from '../draw-morph.js';
import { getFatBranchTree } from '../../morph/fat-branch/get-fat-branch-tree.js';


function onMorphClicked(
        refPageData: React.RefObject<PageData | null>) {

    const { props, morphRef, morphT } = refPageData.current!;
    const { pageState } = props;
    const { deduced } = pageState;
    const { mats1, mats2 } = deduced;

    //-----------
    // Get trees
    //-----------
    const tree1 = getFatBranchTree(mats1[0].cpNode);
    const tree2 = getFatBranchTree(mats2[0].cpNode);
    if (tree1 === undefined || tree2 === undefined) { return; }

    //--------------------------------------------
    // Match tree branches and build morph entries
    //--------------------------------------------
    morphRef.current = buildMorphEntries(tree1, tree2);

    drawMorph(refPageData, morphT / 100);
}


export { onMorphClicked }
