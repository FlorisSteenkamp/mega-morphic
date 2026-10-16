import type { PageData } from "../../page/page-data.js";
import { poseCorrectionAt } from "../procrustes/pose-ramp.js";
import { calcProcrustes$ } from "../procrustes/calc-procrustes.js";
import { resolveMorphAt } from "../resolve-morph-at/resolve-morph-at.js";
import { entryNetTurns } from "../resolve-morph-at/get-morphed-skeleton.js";
import { drawBeziersAsSinglePath } from "../../draw/draw-beziers-as-single-path.js";
import { drawLoopsAsPath } from './draw-loops-as-path.js';
import { drawPoseGizmo } from './draw-pose-gizmo.js';
import { mapDeep } from "../../utils/map-deep.js";
import { getG } from "../../draw/get-g.js";


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

    let { drawn, outlines, outlineEntry } = resolveMorphAt(entries, t);

    // Pin the drawn shape's MEASURED pose onto the interpolated pose path
    // (procrustes): straight centroid line, constant angular rate,
    // geometric scale - the shape blend alone wanders off the path.
    if (outlines.length > 0) {
        const measured = calcProcrustes$(outlines.flat());
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
        const trunk = entries.find(e => e.glue === undefined);
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
                classes.replace(/thin\d+/, 'thin10')
                    .replace('fill25', 'nofill'));
        }
    }

    for (let i = 0; i < entries.length; i++) {
        const pss = drawn[i];
        const { classes } = entries[i];

        drawBeziersAsSinglePath(g3, pss, classes);
    }
}


export { drawMorph }
