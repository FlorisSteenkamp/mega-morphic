import { XMLNS } from './xmlns.js';


/**
 * Draws a 45°-rotated cross (×) of half-size `s` centred at `p` into `g`,
 * with the given classes; returns the element.
 *
 * @param g the group to draw into
 * @param p the cross's centre
 * @param s the half-size of the cross (its arms reach `s` along each axis)
 * @param classes the element's classes
 */
function drawCross(
        g: SVGGElement,
        p: number[],
        s: number,
        classes: string): SVGPathElement {

    const [x, y] = p;
    const $path = document.createElementNS(XMLNS, 'path');
    $path.setAttributeNS(null, 'd',
        `M${x - s} ${y - s} L${x + s} ${y + s} ` +
        `M${x - s} ${y + s} L${x + s} ${y - s}`);
    $path.setAttributeNS(null, 'class', classes);
    g.appendChild($path);

    return $path;
}


export { drawCross }
