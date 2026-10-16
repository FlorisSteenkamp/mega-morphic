import type { CpNode } from 'flo-mat';
import { drawFs } from 'flo-draw';


/** @hidden */
function drawOneProng(
        g: SVGGElement,
        cp: CpNode,
        delay = 0,
        scaleFactor = 1) {

    const { pointOnShape: pos } = cp;
    const { circle, p: p1 } = pos;
    const p2 = cp.nextOnCircle.pointOnShape.p;

    const $posP = drawFs.dot(g, p1, 0.02*scaleFactor, 'deeppink', delay);
    const $posP2 = drawFs.dot(g, p2, 0.04*scaleFactor, 'deeppink', delay);

    const $line = p1[0] !== p2[0] || p1[1] !== p2[1]
        ? drawFs.line(g, [p1, p2], 'deeppink thin10 nofill', delay)
        : [];

    const $circleCenter = drawFs.dot(g, circle.center, 0.01*scaleFactor, 'deeppink', delay);
    const $circle = drawFs.circle(g, circle, 'deeppink thin5 nofill', delay);

    return [...$posP, ...$posP2, ...$line, ...$circleCenter, ...$circle];
}


export { drawOneProng }
