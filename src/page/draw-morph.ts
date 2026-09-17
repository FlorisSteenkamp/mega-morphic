import type { PageData } from "./page-data";
import type { MorphEntry, Glue } from "../morph/morph-entry.js";
import type { FeatureMark } from "../morph/build-morph-entries/build-morph-entries.js";
import { poseCorrectionAt } from "../morph/pose-ramp.js";
import { procrustes } from "../morph/procrustes/procrustes-analysis.js";
import { evalDeCasteljau } from "flo-bezier3";
import { resolveMorphAt } from "../morph/resolve-morph-at.js";
import { drawBeziersAsSinglePath } from "../draw/draw-beziers-as-single-path";
import { XMLNS } from "../draw/xmlns.js";


function drawCircle(
        g: SVGGElement,
        center: number[],
        radius: number,
        classes: string) {

    const $c = document.createElementNS(XMLNS, 'circle');
    $c.setAttributeNS(null, 'cx', center[0].toString());
    $c.setAttributeNS(null, 'cy', center[1].toString());
    $c.setAttributeNS(null, 'r', radius.toString());
    $c.setAttributeNS(null, 'class', classes);
    g.appendChild($c);
}


/** Draws multiple closed loops as one (nonzero fill-rule) compound path. */
function drawLoopsAsPath(
        g: SVGGElement,
        loops: number[][][][],
        classes: string) {

    let d = '';
    for (const loop of loops) {
        if (loop.length === 0) { continue; }
        d += `M${loop[0][0][0]} ${loop[0][0][1]} `;
        for (const ps of loop) {
            const [,p1,p2,p3] = ps;
            d += ps.length === 2
                ? `L ${p1[0]} ${p1[1]} `
                : ps.length === 3
                ? `Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} `
                : `C ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]} `;
        }
        d += 'Z ';
    }
    if (d === '') { return; }

    const $path = document.createElementNS(XMLNS, 'path');
    $path.setAttributeNS(null, 'd', d);
    $path.setAttributeNS(null, 'class', classes);
    g.appendChild($path);
}


/** The point at fractional segment-boundary index `kf` along a bezier path. */
function pointAtIndex(bz: number[][][], kf: number): number[] {
    const j = Math.max(0, Math.min(bz.length - 1, Math.floor(kf)));
    return evalDeCasteljau(bz[j], Math.max(0, Math.min(1, kf - j)));
}


/**
 * Pose gizmo MEASURED from the drawn outlines: a ring at the area centroid
 * with radius ∝ √area (the scale indicator) and a thin line along the
 * principal axis (the rotation indicator) - lets the pose be tracked
 * through the morph.
 */
function drawPoseGizmo(g: SVGGElement, outlines: number[][][][]) {
    if (outlines.length === 0) { return; }

    const { centroid, scale, angle } = procrustes(outlines.flat());
    const [cx, cy] = centroid;

    const $ring = document.createElementNS(XMLNS, 'circle');
    $ring.setAttributeNS(null, 'cx', `${cx}`);
    $ring.setAttributeNS(null, 'cy', `${cy}`);
    $ring.setAttributeNS(null, 'r', `${0.2 * scale}`);
    $ring.setAttributeNS(null, 'class', 'blue thin10 nofill');
    g.appendChild($ring);

    const dx = Math.cos(angle) * 0.6 * scale;
    const dy = Math.sin(angle) * 0.6 * scale;
    const $axis = document.createElementNS(XMLNS, 'path');
    $axis.setAttributeNS(null, 'd',
        `M${cx - dx} ${cy - dy} L${cx + dx} ${cy + dy}`);
    $axis.setAttributeNS(null, 'class', 'blue thin2 nofill');
    g.appendChild($axis);
}


/** Interpolate every morph drawable at `t` ∈ [0,1] and draw. */
function drawMorph(
        refPageData: React.RefObject<PageData | null>,
        t: number) {

    const { morphRef, morphMarksRef, morphPoseRef, svgRef3, props } =
        refPageData.current!;
    const { morphFillOnly: fillOnly, showPose } =
        props.stateControl.state.appState.pageState;

    const entries = morphRef.current;
    if (!entries) { return; }

    let { drawn, radii, outlines } = resolveMorphAt(entries, t);

    // Pin the drawn shape's MEASURED pose onto the interpolated pose path
    // (procrustes): straight centroid line, constant angular rate,
    // geometric scale - the shape blend alone wanders off the path.
    const ramp = morphPoseRef.current;
    if (ramp !== null && outlines.length > 0) {
        const measured = procrustes(outlines.flat());
        const { tf, scale } = poseCorrectionAt(ramp, t, measured);
        drawn = drawn.map(bz => bz.map(ps => ps.map(tf)));
        outlines = outlines.map(loop => loop.map(ps => ps.map(tf)));
        radii = radii.map(rs => rs?.map(r => r * scale));
    }

    const g3 = svgRef3.current!.getElementsByTagName('g')[0];
    g3.replaceChildren();

    // The morphed boundary, drawn first so skeletons render on top.
    drawLoopsAsPath(g3, outlines,
        fillOnly ? 'black nostroke' : 'gray thin10 fill25');

    if (showPose) { drawPoseGizmo(g3, outlines); }

    if (fillOnly) { return; }

    for (let i = 0; i < entries.length; i++) {
        const bz = drawn[i];
        const { classes } = entries[i];
        const rs = radii[i];

        drawBeziersAsSinglePath(g3, bz, classes);

        // The morphing maximal disks at the segment boundaries.
        // if (rs !== undefined) {
        //     // CSS order (not class order) decides ties - swap, don't append.
        //     const diskClasses = classes.replace(/thin\d+k?/, 'thin10');
        //     for (let k = 0; k <= bz.length; k++) {
        //         drawCircle(g3, pointAtIndex(bz, k), rs[k], diskClasses);
        //     }
        // }
    }

    // Feature marks riding the drawn skeletons (glue points slide k1 → k2).
    drawMovingMarks(g3, morphMarksRef.current, drawn, t);
}


/** Draws the feature marks at their positions on the DRAWN entries at `t`
 *  (crosses = anchors, dots = plain attachments). */
function drawMovingMarks(
        g: SVGGElement,
        marks: FeatureMark[] | null,
        drawn: number[][][][],
        t: number) {

    if (marks === null) { return; }

    const size = 12;
    for (const { at, classes, dot } of marks) {
        if (at === undefined || drawn[at.e] === undefined) { continue; }
        const p = pointAtIndex(drawn[at.e], (1 - t)*at.k1 + t*at.k2);

        if (dot) {
            const $c = document.createElementNS(XMLNS, 'circle');
            $c.setAttributeNS(null, 'cx', `${p[0]}`);
            $c.setAttributeNS(null, 'cy', `${p[1]}`);
            $c.setAttributeNS(null, 'r', '3');
            $c.setAttributeNS(null, 'class', classes);
            g.appendChild($c);
            continue;
        }
        const $path = document.createElementNS(XMLNS, 'path');
        $path.setAttributeNS(null, 'd',
            `M${p[0] - size} ${p[1]} L${p[0] + size} ${p[1]} ` +
            `M${p[0]} ${p[1] - size} L${p[0]} ${p[1] + size}`);
        $path.setAttributeNS(null, 'class', classes);
        g.appendChild($path);
    }
}


export { drawMorph }
export type { MorphEntry, Glue }
