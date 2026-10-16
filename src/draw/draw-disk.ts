import { XMLNS } from "./xmlns.js";


/**
 * Draws a circle (or disk, depending on the given classes).
 * @param g An SVG group element wherein to draw the circle.
 * @param center The circle center
 * @param radius The radius in user units, or as a percentage string of the
 * viewport (e.g. '0.5%') for a size independent of the zoom level
 * @param classes CSS classes, e.g. 'pinker thin5 nofill'
 * @param delay If given, the circle is removed after this many milliseconds
 */
function drawDisk(
        g: SVGGElement,
        center: number[],
        radius: number | string,
        classes = '',
        delay?: number) {

    const [x, y] = center;

    const $disk = document.createElementNS(XMLNS, 'circle');
    $disk.setAttributeNS(null, "cx", x.toString());
    $disk.setAttributeNS(null, "cy", y.toString());
    $disk.setAttributeNS(null, "r", radius.toString());
    $disk.setAttributeNS(null, "class", classes);

    g.appendChild($disk);

    if (delay) { setTimeout(() => $disk.remove(), delay); }

    return [$disk];
}


export { drawDisk }
