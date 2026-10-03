import type { PageData } from '../page-data.js';
import type { FeatureMark } from '../../morph/build-morph-entries/build-morph-entries.js';
import { buildMorphEntries } from '../../morph/build-morph-entries/build-morph-entries.js';
import { applyProcrustes } from '../../morph/apply-procrustes.js';
import { drawMorph } from '../../morph/draw-morph/draw-morph.js';
import { segGraphFromMat } from '../../morph/segment-graph/seg-graph-from-mat.js';
import { XMLNS } from '../../draw/xmlns.js';
import { drawMatch } from './draw-match.js';
import { showVertexNums } from './show-vertex-nums.js';


function onMorphClicked(
        refPageData: React.RefObject<PageData | null>) {

    //-------------
    // Gather data
    //-------------
    const { props, morphRef, morphMarksRef } = refPageData.current!;

    const { stateControl } = props;
    const { upd, state: { appState } } = stateControl;
    const { pageState } = appState;
    const { deduced, morphT, poseOptions, pathWeights } = pageState;
    const { mats1, mats2 } = deduced;

    //----------------------------------------------
    // Cut the segment graphs directly off the MATs
    //----------------------------------------------
    const gA = segGraphFromMat(mats1[0].cpNode);
    const gB = segGraphFromMat(mats2[0].cpNode);

    //--------------------------------------------
    // Match the graphs and build morph entries
    //--------------------------------------------
    const marks: FeatureMark[] = [];
    const morphEntries = buildMorphEntries(gA, gB, marks, pathWeights);

    //--------------------------------------------------------
    // Pose-align shape 2's frame onto shape 1 (when enabled)
    //--------------------------------------------------------
    const posed = applyProcrustes(gA.loop, gB.loop, morphEntries, poseOptions);

    morphRef.current = posed?.entries ?? morphEntries;
    morphMarksRef.current = marks;
    // Derived per-morph data (also CLEARS a stale pose when the pose
    // checkboxes are off).
    upd(deduced, { morphPose: posed?.poseRamp });

    //--------------------------------
    // Don't delete - keep for future
    //--------------------------------
    // drawFeatureMarks(svgRef1.current,
    //     marks
    //     .filter(m => m.pA !== undefined)
    //     .map(m => ({ p: m.pA!, classes: m.classes, dot: m.dot })));
    // drawFeatureMarks(svgRef2.current,
    //     marks
    //     .filter(m => m.pB !== undefined)
    //     .map(m => ({ p: m.pB!, classes: m.classes, dot: m.dot })));
    //--------------------------------

    drawMorph(refPageData, morphT / 100);

    // Refresh the overlay for the newly built match.
    if (pageState.showMatch) { drawMatch(refPageData, true, pageState.showMatchBoundary); }
    if (pageState.showBranchNums) { showVertexNums(refPageData, true); }
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


export { onMorphClicked }
