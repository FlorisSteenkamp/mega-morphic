import type { PageData } from '../page-data.js';
import type { PoseRamp } from '../../morph/procrustes/pose-ramp.js';
import { buildMorphEntries } from '../../morph/build-morph-entries/build-morph-entries.js';
import { alignEntriesBToA } from '../../morph/procrustes/align-entries-b-to-a.js';
import { drawMorph } from '../../morph/draw-morph/draw-morph.js';
import { segTreeFromCp } from '../../morph/segment-tree/seg-tree-from-cp.js';
import { drawMatch } from './draw-match.js';
import { showVertexNums } from './show-vertex-nums.js';
import { calcPoseAt } from '../../morph/procrustes/calc-pose-at.js';
import { outlineLoopOf } from '../../morph/segment-tree/outline-loop.js';
import { drawTrunkStartCrosses } from './draw-trunk-start-crosses.js';


function onMorphClicked(
        refPageData: React.RefObject<PageData | null>) {

    //-------------
    // Gather data
    //-------------
    const { props, morphRef } = refPageData.current!;

    const { stateControl } = props;
    const { upd, state: { appState } } = stateControl;
    const { pageState } = appState;
    const {
        deduced, morphT, pathWeights, showMatchBoundary, showBranchNums,
        showMatch
    } = pageState;
    const { mats1, mats2 } = deduced;

    //----------------------------------------------
    // Cut the segment trees directly off the MATs
    //----------------------------------------------
    const cpA = mats1[0].cpNode;
    const cpB = mats2[0].cpNode;
    const sgA = segTreeFromCp(cpA);
    const sgB = segTreeFromCp(cpB);

    const loopA = outlineLoopOf(cpA);
    const loopB = outlineLoopOf(cpB);

    //--------------------------------------------
    // Match the trees and build morph entries
    //--------------------------------------------
    const morphEntries = buildMorphEntries(sgA, sgB, loopA, loopB, pathWeights);

    //----------------------------------------
    // Pose-align shape B's frame onto shape A
    //----------------------------------------
    // Both poses in the DRAW-TIME metric (see calcPoseAt), so the frame
    // alignment, the ramp endpoints and the live correction all agree.
    const poseA = calcPoseAt(morphEntries, 0);
    const poseB = calcPoseAt(morphEntries, 1);
    const poseRamp: PoseRamp = { poseA, poseB };
    const entries = alignEntriesBToA(morphEntries, poseA, poseB);

    morphRef.current = entries;
    upd(deduced, { morphPose: poseRamp });

    // × at the matched trunk's start on both glyphs
    drawTrunkStartCrosses(refPageData, morphEntries);

    drawMorph(refPageData, morphT / 100);

    // Refresh the overlay for the newly built match.
    if (showMatch) { drawMatch(refPageData, true, showMatchBoundary); }
    if (showBranchNums) { showVertexNums(refPageData, true); }
}


export { onMorphClicked }
