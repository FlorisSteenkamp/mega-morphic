import type { PageData } from "../../page/page-data.js";
import type { MorphEntry, Glue } from "../morph-entry.js";
import { poseCorrectionAt } from "../pose-ramp.js";
import { procrustes } from "../procrustes/procrustes-analysis.js";
import { resolveMorphAt } from "../resolve-morph-at/resolve-morph-at.js";
import { drawBeziersAsSinglePath } from "../../draw/draw-beziers-as-single-path.js";
import { drawLoopsAsPath } from './draw-loops-as-path.js';
import { drawPoseGizmo } from './draw-pose-gizmo.js';
import { drawMovingMarks } from './draw-moving-marks.js';


/** Interpolate every morph drawable at `t` ∈ [0,1] and draw. */
function drawMorph(
        refPageData: React.RefObject<PageData | null>,
        t: number) {

    const { morphRef, morphMarksRef, morphPoseRef, svgRef3, props } =
        refPageData.current!;
    const { morphFillOnly: fillOnly, showPose, showMorphBounds } =
        props.stateControl.state.appState.pageState;

    const entries = morphRef.current;
    if (!entries) { return; }

    let { drawn, radii, outlines, outlineEntry } = resolveMorphAt(entries, t);

    // Pin the drawn shape's MEASURED pose onto the interpolated pose path
    // (procrustes): straight centroid line, constant angular rate,
    // geometric scale - the shape blend alone wanders off the path.
    const ramp = morphPoseRef.current;
    if (ramp !== null && outlines.length > 0) {
        const measured = procrustes(outlines.flat());
        const { tf, scale } = poseCorrectionAt(ramp, t, measured);
        drawn = drawn.map(pss => pss.map(ps => ps.map(tf)));
        outlines = outlines.map(loop => loop.map(ps => ps.map(tf)));
        radii = radii.map(rs => rs?.map(r => r * scale));
    }

    const g3 = svgRef3.current!.getElementsByTagName('g')[0];
    g3.replaceChildren();

    // The morphed boundary, drawn first so skeletons render on top.
    drawLoopsAsPath(
        g3, outlines,
        fillOnly ? 'black nostroke' : 'gray thin10 fill25'
    );

    if (showPose) { drawPoseGizmo(g3, outlines); }

    if (fillOnly) { return; }

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

    // Feature marks riding the drawn skeletons (glue points slide k1 → k2).
    drawMovingMarks(g3, morphMarksRef.current, drawn, t);
}


export { drawMorph }
export type { MorphEntry, Glue }
