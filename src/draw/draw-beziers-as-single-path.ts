import { XMLNS } from "./xmlns.js";
import { segD } from "./seg-d.js";


function drawBeziersAsSinglePath(
        g: SVGGElement,
        beziers: number[][][],
        class_ = 'thin10 red nofill',
        delay = 0) {

    if (beziers.length === 0) { return []; }

    let d = '';
    /** the current subpath's end (undefined before the first move) */
    let last: number[] | undefined;

    for (let i=0; i<beziers.length; i++) {
        const ps = beziers[i];

        if (ps.length <= 1) { continue; }

        const p0 = ps[0];

        // non-contiguous beziers (e.g. a reversed route step, or a whole
        // subtree) start a new subpath instead of being joined to the last
        if (last === undefined ||
            Math.hypot(last[0] - p0[0], last[1] - p0[1]) > 1e-6) {
            d += `M${p0[0]} ${p0[1]} `;
        }
        last = ps[ps.length - 1];

        d += segD(ps);
    }

    // d += ' z';
    const $path = document.createElementNS(XMLNS, 'path');
    $path.setAttributeNS(null, "d", d);
    $path.setAttributeNS(null, "class", class_);
    g.appendChild($path);

    if (delay) { setTimeout(() => $path.remove(), delay); }

    return [$path];
}


export { drawBeziersAsSinglePath }
