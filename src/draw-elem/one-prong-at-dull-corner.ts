import type { PointOnShape } from 'flo-mat';
import { drawFs } from 'flo-draw';
import { getOsculatingCircle } from 'flo-mat';


/** @hidden */
function oneProngAtDullCorner(
        g: SVGGElement,
        pos: PointOnShape,
        classes?: string,
        delay = 1000,
        scaleFactor = 1) {

    //let oCircle = PointOnShape.getOsculatingCircle(Infinity, pos);
    const oCircle = getOsculatingCircle(Infinity, pos);

    const $center = drawFs.dot(g, pos.p, 0.1, 'orange');
    const $circle = drawFs.dot(g, oCircle.center, 0.25, 'orange');
    const $pos    = drawFs.circle(g, oCircle, 'orange thin10 nofill');
        
    return [...$center, ...$circle, ...$pos];
}


export { oneProngAtDullCorner }
