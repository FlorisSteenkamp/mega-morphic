import type { PageData } from '../page-data.js';
import type { FeatureMark } from '../../morph/build-morph-entries.js';
import { buildMorphEntries } from '../../morph/build-morph-entries.js';
import { drawMorph } from '../draw-morph.js';
import { getFatBranchTree } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { XMLNS } from '../../draw/xmlns.js';


function onMorphClicked(
        refPageData: React.RefObject<PageData | null>) {

    const { props, morphRef, morphT, svgRef1, svgRef2 } = refPageData.current!;
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
    const marks: FeatureMark[] = [];
    morphRef.current = buildMorphEntries(tree1, tree2, marks);

    drawFeatureMarks(svgRef1.current, marks.map(m => ({ p: m.pA, classes: m.classes })));
    drawFeatureMarks(svgRef2.current, marks.map(m => ({ p: m.pB, classes: m.classes })));

    drawMorph(refPageData, morphT / 100);
}


/** Little crosses at matched feature positions (replaces previous ones). */
function drawFeatureMarks(
        svg$: SVGSVGElement | null,
        marks: { p: number[]; classes: string }[]) {

    if (svg$ === null) { return; }
    const g = svg$.getElementsByTagName('g')[0];

    g.querySelectorAll('.feature-mark').forEach($ => $.remove());

    const size = 12;
    for (const { p, classes } of marks) {
        const $path = document.createElementNS(XMLNS, 'path');
        $path.setAttributeNS(null, 'd',
            `M${p[0] - size} ${p[1]} L${p[0] + size} ${p[1]} ` +
            `M${p[0]} ${p[1] - size} L${p[0]} ${p[1] + size}`);
        $path.setAttributeNS(null, 'class', `${classes} feature-mark`);
        g.appendChild($path);
    }
}


export { onMorphClicked }
