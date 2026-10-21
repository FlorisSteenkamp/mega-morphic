import type { PageData } from "../../page/page-data.js";
import { poseCorrectionAt } from "../procrustes/pose-ramp.js";
import { calcProcrustes$ } from "../procrustes/calc-procrustes.js";
import { resolveMorphAt } from "../resolve-morph-at/resolve-morph-at.js";
import { entryNetTurns } from "../resolve-morph-at/get-morphed-skeleton.js";
import { drawBeziersAsSinglePath } from "../../draw/draw-beziers-as-single-path.js";
import { drawLoopsAsPath } from './draw-loops-as-path.js';
import { drawPoseGizmo } from './draw-pose-gizmo.js';
import { mapDeep } from "../../utils/map-deep.js";
import { mainOutlinesOf } from "../procrustes/main-outlines-of.js";
import { getG } from "../../draw/get-g.js";
import { drawCross } from "../../draw/draw-cross.js";
import { CROSS_SIZE, CROSS_CLASSES } from "../../page/events/draw-trunk-start-crosses.js";


/** Interpolate every morph drawable at `t` ∈ [0,1] and draw. */
function drawMorph(
        refPageData: React.RefObject<PageData | null>,
        t: number) {

    const { morphRef, svgRef3, props } = refPageData.current!;
    const { stateControl } = props;
    const { state: { appState } } = stateControl;
    const { pageState } = appState;
    const { morphPose } = pageState.deduced;
    const { morphFillOnly, showPose, showMorphBounds } = pageState;
    

    const entries = morphRef.current;
    if (!entries) { return; }

    const resolved = resolveMorphAt(entries, t);
    let { drawn, outlines } = resolved;
    const { outlineEntry } = resolved;

    // Pin the drawn shape's MEASURED pose onto the interpolated pose path
    // (procrustes): straight centroid line, constant angular rate,
    // geometric scale - the shape blend alone wanders off the path. Only
    // the matched components are measured (the ones without a partner
    // shrink or grow, and ride the matched shape via their tethers).
    const mainOutlines = mainOutlinesOf(entries, resolved);
    if (mainOutlines.length > 0) {
        const measured = calcProcrustes$(mainOutlines.flat());
        const tf = poseCorrectionAt(morphPose, t, measured);

        drawn = mapDeep(3, drawn, tf);
        outlines = mapDeep(3, outlines, tf);
    }

    const g3 = getG(svgRef3.current!);
    g3.replaceChildren();

    // The morphed boundary, drawn first so skeletons render on top.
    drawLoopsAsPath(
        g3, outlines,
        morphFillOnly ? 'black nostroke' : 'gray thin10 fill25'
    );

    if (showPose) {
        // Tisserand readout: the trunk gauge's whole-turn count + current
        // gauge rotation.
        const trunk = entries.find(
            e => e.glue === undefined && e.collapsed === undefined);
        drawPoseGizmo(g3, outlines, {
            m: trunk !== undefined ? entryNetTurns(trunk) : 0,
            t
        });
    }

    if (morphFillOnly) { return; }

    // Per-entry boundary loops in the entry's color (over the gray union).
    if (showMorphBounds) {
        for (let k = 0; k < outlines.length; k++) {
            const { classes } = entries[outlineEntry[k]];
            drawLoopsAsPath(g3, [outlines[k]],
                classes.replace(/thin\d+/, 'thin10'));
        }
    }

    for (let i = 0; i < entries.length; i++) {
        const pss = drawn[i];
        const { classes } = entries[i];

        drawBeziersAsSinglePath(g3, pss, classes);
    }

    // × at the trunk's start (entry 0), where both glyphs' trunk starts meet
    if (drawn.length > 0) {
        drawCross(g3, drawn[0][0][0], CROSS_SIZE, CROSS_CLASSES);
    }
}


export { drawMorph }
