import type { CpNode } from 'flo-mat';
import { drawFs } from 'flo-draw';


/** @internal */
function drawVertex(
        g: SVGGElement,
        cpNode: CpNode,
        delay = 0,
        scaleFactor = 1) {

    const { center } = cpNode.pointOnShape.circle;

    return drawFs.dot(g, center, 0.01*scaleFactor, 'darkgreen', delay);
}


export { drawVertex }
