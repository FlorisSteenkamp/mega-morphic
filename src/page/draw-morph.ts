import type { PageData } from "./page-data";
import type { MorphEntry, Glue } from "../morph/morph-entry.js";
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


/** Interpolate every morph drawable at `t` ∈ [0,1] and draw. */
function drawMorph(
        refPageData: React.RefObject<PageData | null>,
        t: number) {

    const { morphRef, svgRef3, props } = refPageData.current!;
    const fillOnly =
        props.stateControl.state.appState.pageState.morphFillOnly;

    const entries = morphRef.current;
    if (!entries) { return; }

    const { drawn, radii, outlines } = resolveMorphAt(entries, t);

    const g3 = svgRef3.current!.getElementsByTagName('g')[0];
    g3.replaceChildren();

    // The morphed boundary, drawn first so skeletons render on top.
    drawLoopsAsPath(g3, outlines,
        fillOnly ? 'black nostroke' : 'gray thin10 fill25');

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
}


export { drawMorph }
export type { MorphEntry, Glue }
