import type { FeatureMark } from "../build-morph-entries/build-morph-entries.js";
import { evalDeCasteljau } from "flo-bezier3";
import { XMLNS } from "../../draw/xmlns.js";


/**
 * Draws the feature marks at their positions on the DRAWN entries at `t`
 * (crosses = anchors, dots = plain attachments).
 */
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


/** The point at fractional segment-boundary index `kf` along a bezier path. */
function pointAtIndex(bz: number[][][], kf: number): number[] {
    const j = Math.max(0, Math.min(bz.length - 1, Math.floor(kf)));
    return evalDeCasteljau(bz[j], Math.max(0, Math.min(1, kf - j)));
}


export { drawMovingMarks }
