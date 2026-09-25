import { XMLNS } from "../../draw/xmlns.js";
import { procrustes } from "../procrustes/procrustes-analysis.js";


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


export { drawPoseGizmo }
