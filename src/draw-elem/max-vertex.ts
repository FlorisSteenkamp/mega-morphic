import type { CpNode } from 'flo-mat';
import { drawFs } from 'flo-draw';


/** @internal */
function maxVertex(g: SVGGElement, cpNode: CpNode) {
    const circle = cpNode.pointOnShape.circle;

    const $elems = drawFs.circle(g, circle, 'brown thin10 nofill');
        
    return $elems;
}


export { maxVertex }
