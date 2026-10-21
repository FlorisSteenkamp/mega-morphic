import type { PageData } from '../page-data.js';
import type { PoseRamp } from '../../morph/procrustes/pose-ramp.js';
import { buildGlyphMorphEntries } from '../../morph/build-morph-entries/build-glyph-morph-entries.js';
import { alignEntriesBToA } from '../../morph/procrustes/align-entries-b-to-a.js';
import { drawMorph } from '../../morph/draw-morph/draw-morph.js';
import { drawMatch } from './draw-match.js';
import { showVertexNums } from './show-vertex-nums.js';
import { calcPoseAt } from '../../morph/procrustes/calc-pose-at.js';
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

    //------------------------------------------------------------------
    // Match the glyphs' components (one MAT each), then each matched
    // pair's trees, and build the morph entries
    //------------------------------------------------------------------
    const morphEntries = buildGlyphMorphEntries(
        mats1.map(m => m.cpNode), mats2.map(m => m.cpNode), pathWeights);

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
