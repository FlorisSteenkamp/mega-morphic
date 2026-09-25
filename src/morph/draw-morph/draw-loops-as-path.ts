import { XMLNS } from "../../draw/xmlns.js";


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


export { drawLoopsAsPath }
