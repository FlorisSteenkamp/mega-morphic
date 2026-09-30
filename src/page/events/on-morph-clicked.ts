import type { PageData } from '../page-data.js';
import type { FeatureMark } from '../../morph/build-morph-entries/build-morph-entries.js';
import type { PoseRamp, PoseComponents } from '../../morph/pose-ramp.js';
import { buildMorphEntries } from '../../morph/build-morph-entries/build-morph-entries.js';
import { drawMorph } from '../../morph/draw-morph/draw-morph.js';
import { getFatBranchTree, getSkeletonBeziers } from '../../morph/fat-branch/get-fat-branch-tree.js';
import { XMLNS } from '../../draw/xmlns.js';
import { getFattestCpNode } from '../../morph/fat-branch/get-fattest-cp-node.js';
import { drawMatch } from './draw-match.js';
import { showBranchNums } from './show-branch-nums.js';


function onMorphClicked(
        refPageData: React.RefObject<PageData | null>) {

    const { props, morphRef, morphMarksRef, morphPoseRef,
        svgRef1, svgRef2 } = refPageData.current!;
    const { pageState } = props;
    const { deduced, morphT } = pageState;
    const { mats1, mats2 } = deduced;

    //-----------
    // Get trees
    //-----------
    const tree1 = getFatBranchTree(getFattestCpNode(mats1[0].cpNode));
    const tree2 = getFatBranchTree(getFattestCpNode(mats2[0].cpNode));
    if (tree1 === undefined || tree2 === undefined) { return; }

    //--------------------------------------------
    // Match tree branches and build morph entries
    //--------------------------------------------
    const marks: FeatureMark[] = [];
    const { poseCentroid, poseScale, poseMoment } = pageState;
    const poseOut = poseCentroid || poseScale || poseMoment
        ? {
            components: {
                centroid: poseCentroid,
                scale: poseScale,
                moment: poseMoment
            }
        } as { components: PoseComponents; ramp?: PoseRamp }
        : undefined;
    morphRef.current = buildMorphEntries(
        tree1, tree2, marks, pageState.pathWeights, poseOut);
    morphMarksRef.current = marks;
    morphPoseRef.current = poseOut?.ramp ?? null;

    drawFeatureMarks(svgRef1.current,
        marks
        .filter(m => m.pA !== undefined)
        .map(m => ({ p: m.pA!, classes: m.classes, dot: m.dot })));
    drawFeatureMarks(svgRef2.current,
        marks
        .filter(m => m.pB !== undefined)
        .map(m => ({ p: m.pB!, classes: m.classes, dot: m.dot })));

    // × at each tree's trunk skeleton start (its own orientation).
    drawTrunkStartCross(svgRef1.current, getSkeletonBeziers(tree1)[0][0]);
    drawTrunkStartCross(svgRef2.current, getSkeletonBeziers(tree2)[0][0]);

    drawMorph(refPageData, morphT / 100);

    // Refresh the overlay for the newly built match.
    if (pageState.showMatch) {
        drawMatch(refPageData, true, pageState.showMatchBoundary);
    }
    if (pageState.showBranchNums) { showBranchNums(refPageData, true); }
}


/** Little crosses (anchors) / dots (plain attachments) at matched feature
 *  positions (replaces previous ones). */
function drawFeatureMarks(
        svg$: SVGSVGElement | null,
        marks: { p: number[]; classes: string; dot?: boolean }[]) {

    if (svg$ === null) { return; }
    const g = svg$.getElementsByTagName('g')[0];

    g.querySelectorAll('.feature-mark').forEach($ => $.remove());

    const size = 12;
    for (const { p, classes, dot } of marks) {
        if (dot) {
            const $c = document.createElementNS(XMLNS, 'circle');
            $c.setAttributeNS(null, 'cx', `${p[0]}`);
            $c.setAttributeNS(null, 'cy', `${p[1]}`);
            $c.setAttributeNS(null, 'r', '3');
            $c.setAttributeNS(null, 'class', `${classes} feature-mark`);
            g.appendChild($c);
            continue;
        }
        const $path = document.createElementNS(XMLNS, 'path');
        $path.setAttributeNS(null, 'd',
            `M${p[0] - size} ${p[1]} L${p[0] + size} ${p[1]} ` +
            `M${p[0]} ${p[1] - size} L${p[0]} ${p[1] + size}`);
        $path.setAttributeNS(null, 'class', `${classes} feature-mark`);
        g.appendChild($path);
    }
}


/** Thickish purple 45°-rotated cross (×) at the trunk's skeleton start.
 *  Tagged `feature-mark` so the next morph replaces it. */
function drawTrunkStartCross(
        svg$: SVGSVGElement | null,
        p: number[]) {

    if (svg$ === null) { return; }
    const g = svg$.getElementsByTagName('g')[0];

    const s = 14;
    const $path = document.createElementNS(XMLNS, 'path');
    $path.setAttributeNS(null, 'd',
        `M${p[0] - s} ${p[1] - s} L${p[0] + s} ${p[1] + s} ` +
        `M${p[0] - s} ${p[1] + s} L${p[0] + s} ${p[1] - s}`);
    $path.setAttributeNS(null, 'class', 'purple thin50 nofill feature-mark');
    g.appendChild($path);
}


export { onMorphClicked }
