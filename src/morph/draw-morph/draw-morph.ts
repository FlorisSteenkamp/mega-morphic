import type { PageData } from "../../page/page-data.js";
import { poseCorrectionAt } from "../procrustes/pose-ramp.js";
import { calcPlacement } from "../procrustes/calc-placement.js";
import { resolveMorphAt } from "../resolve-morph-at/resolve-morph-at.js";
import { entryNetTurns } from "../resolve-morph-at/get-morphed-skeleton.js";
import { drawBeziersAsSinglePath } from "../../draw/draw-beziers-as-single-path.js";
import { drawLoopsAsPath } from './draw-loops-as-path.js';
import { drawPoseGizmo } from './draw-pose-gizmo.js';
import { addMorphingFill, calcMorphColor, VIEW_BACKGROUND } from './morphing-fill.js';
import { mapDeep } from "../../utils/map-deep.js";
import { mainOutlinesOf } from "../procrustes/main-outlines-of.js";
import { getG } from "../../draw/get-g.js";
import { drawCross } from "../../draw/draw-cross.js";
import { CROSS_SIZE, CROSS_CLASSES } from "../../page/events/draw-trunk-start-crosses.js";
import { XMLNS } from "../../draw/xmlns.js";


/** the id of the morph view's hole mask (`addHoleMask`) */
const HOLE_MASK_ID = 'morph-hole-mask';
/** the hole mask's half-extent - covers any glyph's coordinates */
const HOLE_MASK_EXTENT = 1e6;


/** Interpolate every morph drawable at `t` ∈ [0,1] and draw. */
function drawMorph(
        refPageData: React.RefObject<PageData | null>,
        t: number) {

    const { morphRef, svgRef3, props } = refPageData.current!;
    const { stateControl } = props;
    const { state: { appState } } = stateControl;
    const { pageState } = appState;
    const { morphPose } = pageState.deduced;
    const { morphFillOnly, morphPattern, showPose } = pageState;


    const entries = morphRef.current;
    if (!entries) { return; }

    const resolved = resolveMorphAt(entries, t);
    let { drawn, outlines } = resolved;

    // Pin the drawn shape's MEASURED placement onto the interpolated pose
    // path: straight centroid line, geometric scale - the shape blend
    // alone wanders off the path. Only the matched components are measured
    // (the ones without a partner shrink or grow, and ride the matched
    // shape via their tethers).
    const mainOutlines = mainOutlinesOf(entries, resolved);
    if (mainOutlines.length > 0) {
        const measured = calcPlacement(mainOutlines.flat());
        const tf = poseCorrectionAt(morphPose, t, measured);

        drawn = mapDeep(3, drawn, tf);
        outlines = mapDeep(3, outlines, tf);
    }

    const g3 = getG(svgRef3.current!);
    g3.replaceChildren();

    // fill only: a dark view, for the morph's colors
    svgRef3.current!.style.background = morphFillOnly ? VIEW_BACKGROUND : '';

    // The holes' outlines (`splitHoles`) are cut out of the others'.
    const { outlineEntry } = resolved;
    const solids = outlines.filter((_, k) => entries[outlineEntry[k]].hole !== true);
    const holes = outlines.filter((_, k) => entries[outlineEntry[k]].hole === true);

    // The morphed boundary, drawn first so skeletons render on top - fill
    // only: in a texture that morphs along with the glyph, or in a solid
    // color that morphs
    const $outline = drawLoopsAsPath(
        g3, solids,
        morphFillOnly ? 'nostroke' : 'gray thin10 fill25'
    );
    if ($outline !== undefined && holes.length > 0) {
        $outline.setAttributeNS(null, 'mask', `url(#${addHoleMask(g3, holes)})`);
        if (!morphFillOnly) { drawLoopsAsPath(g3, holes, 'gray thin10 nofill'); }
    }
    if (morphFillOnly && $outline !== undefined) {
        if (morphPattern) {
            const { fill, filter } = addMorphingFill(g3, t, morphPose);
            $outline.style.fill = fill;
            $outline.style.filter = filter;
        } else {
            $outline.style.fill = calcMorphColor(t);
        }
    }

    if (showPose) {
        // Tisserand readout: the trunk gauge's whole-turn count + current
        // gauge rotation.
        const trunk = entries.find(
            e => e.glue === undefined && e.collapsed === undefined);
        drawPoseGizmo(g3, solids, {
            m: trunk !== undefined ? entryNetTurns(trunk) : 0,
            t
        });
    }

    if (morphFillOnly) { return; }

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


/**
 * Adds a mask that hides the union of the given loops (each loop's inside,
 * as a nonzero fill) and returns its id.
 *
 * * a mask rather than reversed loops in the outline's path: the entries'
 *   loops overlap at their seams, so winding numbers can't cut a hole
 *   reliably
 *
 * @param g the group to add the mask to
 * @param holes the holes' loops
 */
function addHoleMask(
        g: SVGGElement,
        holes: number[][][][]): string {

    const $mask = document.createElementNS(XMLNS, 'mask');
    $mask.setAttributeNS(null, 'id', HOLE_MASK_ID);
    $mask.setAttributeNS(null, 'maskUnits', 'userSpaceOnUse');
    $mask.setAttributeNS(null, 'x', `${-HOLE_MASK_EXTENT}`);
    $mask.setAttributeNS(null, 'y', `${-HOLE_MASK_EXTENT}`);
    $mask.setAttributeNS(null, 'width', `${2*HOLE_MASK_EXTENT}`);
    $mask.setAttributeNS(null, 'height', `${2*HOLE_MASK_EXTENT}`);

    // white: shown, black: hidden
    const $all = document.createElementNS(XMLNS, 'rect');
    $all.setAttributeNS(null, 'x', `${-HOLE_MASK_EXTENT}`);
    $all.setAttributeNS(null, 'y', `${-HOLE_MASK_EXTENT}`);
    $all.setAttributeNS(null, 'width', `${2*HOLE_MASK_EXTENT}`);
    $all.setAttributeNS(null, 'height', `${2*HOLE_MASK_EXTENT}`);
    $all.setAttributeNS(null, 'fill', 'white');
    $mask.appendChild($all);
    g.appendChild($mask);

    const $holes = drawLoopsAsPath($mask, holes, '');
    $holes?.setAttributeNS(null, 'fill', 'black');

    return HOLE_MASK_ID;
}


export { drawMorph }
