import type { PageData } from '../page-data.js';
import type { PoseRamp } from '../../morph/procrustes/pose-ramp.js';
import type { Mat } from 'flo-mat';
import type { GlyphComponent } from '../../morph/build-morph-entries/build-glyph-morph-entries.js';
import type { SplitComponent, StaggeredMat } from '../../morph/holes/split-component.js';
import { buildGlyphMorphEntries } from '../../morph/build-morph-entries/build-glyph-morph-entries.js';
import { alignEntriesBToA } from '../../morph/procrustes/align-entries-b-to-a.js';
import { drawMorph } from '../../morph/draw-morph/draw-morph.js';
import { drawOverlay } from './draw-overlay.js';
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
        deduced, morphT, pathWeights, toDraw, splitHoles
    } = pageState;
    const { mats1, mats2, coarseMats1, coarseMats2, splits1, splits2 } = deduced;

    //------------------------------------------------------------------
    // Match the glyphs' components (one MAT each), then each matched
    // pair's trees, and build the morph entries
    //------------------------------------------------------------------
    const morphEntries = buildGlyphMorphEntries(
        componentsOf(mats1, coarseMats1, splitHoles ? splits1 : undefined),
        componentsOf(mats2, coarseMats2, splitHoles ? splits2 : undefined),
        pathWeights);

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
    drawOverlay(refPageData, 'match', toDraw.match);
    drawOverlay(refPageData, 'matchHoles', toDraw.matchHoles);
    drawOverlay(refPageData, 'vertexNums', toDraw.vertexNums);
}


/**
 * Returns a glyph's components: its MATs, each with its coarse SAT (when
 * staggered - `coarseMats` is then parallel to `mats`, else empty) and with
 * its holes split off (`splits` parallel to `mats`; `undefined`: never
 * morphed split).
 */
function componentsOf(
        mats: Mat[],
        coarseMats: Mat[],
        splits: SplitComponent[] | undefined): GlyphComponent[] {

    return mats.map((m, i) => ({
        cp: m.cpNode,
        coarse: coarseMats[i]?.cpNode,
        split: splits === undefined
            ? undefined
            : {
                filled: componentOf(splits[i].filled),
                holes: splits[i].holes.map(componentOf)
            }
    }));
}


/** Returns a split-off shape as a component (never itself split). */
function componentOf(
        sm: StaggeredMat): GlyphComponent {

    const { mat, coarse } = sm;

    return { cp: mat.cpNode, coarse: coarse?.cpNode, split: undefined };
}


export { onMorphClicked }
