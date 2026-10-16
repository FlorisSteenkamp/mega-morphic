import type { PageData } from '../page-data.js';
import { getG } from '../../draw/get-g.js';


/**
 * Removes the overlay elements tagged with class `cls` from svg1 and svg2;
 * returns both drawing groups (`undefined` if either svg isn't mounted).
 */
function clearOverlay(
        pageData: PageData,
        cls: string): [SVGGElement, SVGGElement] | undefined {

    const { svgRef1, svgRef2 } = pageData;
    const g1 = getG(svgRef1.current);
    const g2 = getG(svgRef2.current);
    if (g1 === undefined || g2 === undefined) { return undefined; }

    g1.querySelectorAll(`.${cls}`).forEach($ => $.remove());
    g2.querySelectorAll(`.${cls}`).forEach($ => $.remove());

    return [g1, g2];
}


export { clearOverlay }
