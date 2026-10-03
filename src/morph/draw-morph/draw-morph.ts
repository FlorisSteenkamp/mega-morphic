import type { PageData } from "../../page/page-data.js";
import type { MorphEntry, Glue } from "../morph-entry.js";
import { poseCorrectionAt } from "../procrustes/pose-ramp.js";
import { calcProcrustes } from "../procrustes/calc-procrustes.js";
import { resolveMorphAt } from "../resolve-morph-at/resolve-morph-at.js";
import { trunkOutlines } from "../resolve-morph-at/trunk-outlines.js";
import { entryNetTurns } from "../resolve-morph-at/get-morphed-skeleton.js";
import { drawBeziersAsSinglePath } from "../../draw/draw-beziers-as-single-path.js";
import { drawLoopsAsPath } from './draw-loops-as-path.js';
import { drawPoseGizmo } from './draw-pose-gizmo.js';
import { drawMovingMarks } from './draw-moving-marks.js';
import { mapDeep } from "../../utils/map-deep.js";


/** Interpolate every morph drawable at `t` ∈ [0,1] and draw. */
function drawMorph(
        refPageData: React.RefObject<PageData | null>,
        t: number) {

    const { morphRef, morphMarksRef, svgRef3, props } = refPageData.current!;
    const { stateControl } = props;
    const { state: { appState } } = stateControl;
    const { pageState } = appState;
    const { morphPose } = pageState.deduced;
    const { morphFillOnly, showPose, showMorphBounds, poseOptions } = pageState;
    

    const entries = morphRef.current;
    if (!entries) { return; }

    let { drawn, radii, outlines, outlineEntry } = resolveMorphAt(entries, t);

    // Pin the drawn shape's MEASURED pose onto the interpolated pose path
    // (procrustes): straight centroid line, constant angular rate,
    // geometric scale - the shape blend alone wanders off the path.
    // Trunk-only: measure from the trunk's loops (matches the ramp's
    // endpoint metric).
    if (morphPose !== undefined && outlines.length > 0) {
        const measureLoops = poseOptions.trunkOnlyTisserand
            ? trunkOutlines(entries, outlines, outlineEntry)
            : outlines;
        const measured = calcProcrustes(
            (measureLoops.length > 0 ? measureLoops : outlines).flat());
        const { tf, scale } = poseCorrectionAt(poseOptions, morphPose, t, measured);

        drawn = mapDeep(3, drawn, tf);
        outlines = mapDeep(3, outlines, tf);
        radii = radii.map(rs => rs?.map(r => r * scale));
    }

    const g3 = svgRef3.current!.getElementsByTagName('g')[0];
    g3.replaceChildren();

    // The morphed boundary, drawn first so skeletons render on top.
    drawLoopsAsPath(
        g3, outlines,
        morphFillOnly ? 'black nostroke' : 'gray thin10 fill25'
    );

    if (showPose) {
        // Tisserand readout: the trunk gauge's whole-turn count + current
        // gauge rotation, and (trunk-only mode) the trunk-frame pose that
        // actually steers the correction. Trunk loops here are the DRAWN
        // (corrected) ones - outlineEntry order survives mapDeep.
        const trunk = entries.find(e => e.glue === undefined);
        drawPoseGizmo(g3, outlines, {
            m: trunk !== undefined ? entryNetTurns(trunk) : 0,
            t,
            trunk: poseOptions.trunkOnlyTisserand
                ? trunkOutlines(entries, outlines, outlineEntry)
                : undefined
        });
    }

    if (morphFillOnly) { return; }

    // Per-entry boundary loops in the entry's color (over the gray union).
    if (showMorphBounds) {
        for (let k = 0; k < outlines.length; k++) {
            const { classes } = entries[outlineEntry[k]];
            drawLoopsAsPath(g3, [outlines[k]],
                classes.replace(/thin\d+/, 'thin10')
                    .replace('fill25', 'nofill'));
        }
    }

    for (let i = 0; i < entries.length; i++) {
        const pss = drawn[i];
        const { classes } = entries[i];

        drawBeziersAsSinglePath(g3, pss, classes);
    }

    //--------------------------------
    // Don't delete - keep for future
    //--------------------------------
    // Feature marks riding the drawn skeletons (glue points slide k1 → k2).
    // drawMovingMarks(g3, morphMarksRef.current, drawn, t);
}


export { drawMorph }
export type { MorphEntry, Glue }
