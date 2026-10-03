import { XMLNS } from "../../draw/xmlns.js";
import { calcProcrustes } from "../procrustes/calc-procrustes.js";

const { cos, sin, sqrt, hypot, PI: π } = Math;


/** Tisserand-gauge context for the readout (see getMorphedSkeleton). */
interface TisserandInfo {
    /** the trunk gauge's whole-turn count */
    readonly m: number;
    readonly t: number;
    /** trunk-only loops (drawn frame) when trunkOnlyTisserand is on */
    readonly trunk?: number[][][][];
}


/**
 * Pose gizmo MEASURED from the drawn outlines: a ring at the area centroid
 * with radius ∝ √area (the scale indicator), the principal axes sized as
 * the equivalent-ellipse semi-axes (major blue, minor red - for an ellipse
 * they reproduce its true semi-axes), and a text readout (anisotropy +
 * the two principal moments, normalized by area² so they're dimensionless
 * and size-invariant; plus the Tisserand gauge's turns/rotation and, in
 * trunk-only mode, the trunk-frame pose) - lets the pose be tracked
 * through the morph.
 */
function drawPoseGizmo(
        g: SVGGElement,
        outlines: number[][][][],
        tisserand?: TisserandInfo) {
    if (outlines.length === 0) { return; }

    const { centroid, scale, angle, anisotropy, momMajor, momMinor } =
        calcProcrustes(outlines.flat());
    const [cx, cy] = centroid;

    const $ring = document.createElementNS(XMLNS, 'circle');
    $ring.setAttributeNS(null, 'cx', `${cx}`);
    $ring.setAttributeNS(null, 'cy', `${cy}`);
    $ring.setAttributeNS(null, 'r', `${0.2 * scale}`);
    $ring.setAttributeNS(null, 'class', 'blue thin10 nofill');
    g.appendChild($ring);

    // Equivalent-ellipse semi-axes: a = 2√(V/A) with V the principal
    // second moment of the projections and A the area (= scale²).
    const area = scale * scale;
    const a = 2 * sqrt(momMajor / area);
    const b = 2 * sqrt(momMinor / area);

    axisLine(g, cx, cy, angle, a, 'blue thin2 nofill');
    axisLine(g, cx, cy, angle + π/2, b, 'red thin2 nofill');

    // Readout pinned to the svg's top-left (stable through the morph).
    // The g is y-flipped (getFlipTransform), so convert display→model y
    // about the CURRENT viewbox's y-center; labels counter-flip themselves.
    const svg = g.ownerSVGElement;
    const vb = svg?.viewBox.baseVal;
    if (vb === undefined || vb === null) { return; }

    const ctm = svg?.getScreenCTM();
    const pxPerUnit = ctm === null || ctm === undefined
        ? 1 : hypot(ctm.a, ctm.b);
    const fontSize = 12 / pxPerUnit;

    const flipC = 2*vb.y + vb.height;
    const axisDeg = visualAxisDeg(angle);
    const lines: [string, string][] = [
        [`aniso ${anisotropy.toFixed(3)}`, '#000'],
        [`axis ${axisDeg.toFixed(1)}°`, '#00f'],
        [`Îmaj ${(momMajor / (area * area)).toFixed(4)}`, '#00f'],
        [`Îmin ${(momMinor / (area * area)).toFixed(4)}`, '#f00'],
    ];

    if (tisserand !== undefined) {
        const { m, t, trunk } = tisserand;
        if (m !== 0) {
            lines.push([
                `spin ${m} turn${Math.abs(m) === 1 ? '' : 's'}, ` +
                `gauge ${(-t*m*360).toFixed(0)}°`, '#000']);
        }
        if (trunk !== undefined && trunk.length > 0) {
            const tp = calcProcrustes(trunk.flat());
            lines.push(
                [`T·aniso ${tp.anisotropy.toFixed(3)}`, '#555'],
                [`T·axis ${visualAxisDeg(tp.angle).toFixed(1)}°`, '#555']);
        }
    }
    lines.forEach(([text, color], i) => {
        const yDisplay = vb.y + fontSize*(1 + i*1.2);
        label(g, vb.x + fontSize, flipC - yDisplay, text, fontSize, color);
    });
}


/** Visual CCW-from-x angle in degrees, normalized to [−90, 90): the g's
 *  y-flip and the screen's y-down rendering cancel, so the model angle is
 *  already the one seen. */
function visualAxisDeg(angle: number): number {
    return (((angle*180/π + 90) % 180) + 180) % 180 - 90;
}


/** A line through (cx,cy) along `angle`, extending `halfLen` both ways. */
function axisLine(
        g: SVGGElement,
        cx: number, cy: number,
        angle: number,
        halfLen: number,
        classes: string): void {

    const dx = cos(angle) * halfLen;
    const dy = sin(angle) * halfLen;
    const $axis = document.createElementNS(XMLNS, 'path');
    $axis.setAttributeNS(null, 'd',
        `M${cx - dx} ${cy - dy} L${cx + dx} ${cy + dy}`);
    $axis.setAttributeNS(null, 'class', classes);
    g.appendChild($axis);
}


function label(
        g: SVGGElement,
        x: number, y: number,
        text: string,
        fontSize: number,
        color: string): void {

    const $t = document.createElementNS(XMLNS, 'text');
    $t.setAttributeNS(null, 'x', `${x}`);
    $t.setAttributeNS(null, 'y', `${y}`);
    // Counter-flip about the label's own y (the parent g is y-flipped).
    $t.setAttributeNS(null, 'transform', `matrix(1 0 0 -1 0 ${2*y})`);
    // White casing keeps the text readable on any overlay.
    $t.setAttributeNS(null, 'style',
        `font-size: ${fontSize}px; fill: ${color}; stroke: #fff; ` +
        `stroke-width: ${fontSize / 8}px; ` +
        'paint-order: stroke; font-weight: 700; user-select: none; ' +
        'text-anchor: start; dominant-baseline: central;');
    $t.textContent = text;
    g.appendChild($t);
}


export { drawPoseGizmo }
