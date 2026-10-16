import type { CpNode } from 'flo-mat';
import { drawFs } from 'flo-draw';


/** @internal */
function drawTwoProng(
        drawCrosshair: boolean) {

    return (g: SVGGElement,
            twoProng: CpNode,
            delay = 0,
            scaleFactor = 1) => {

        const [color, thin] = twoProng.isHoleClosing
            ? ['cyan ', '10']
            : ['red ', '2'];

        const { pointOnShape: pos } = twoProng;
        const { circle, isSource, p } = pos;
        const p2 = twoProng.nextOnCircle.pointOnShape.p;
        const pS = isSource ? p : p2;
        const pA = isSource ? p2 : p;

        const { dot, circle: drawCircle, crossHair } = drawFs;

        const $center = dot   (g, circle.center, 0.02*scaleFactor, 'yellow', delay);
        const $circle = drawCircle(g, circle, color + 'thin' + thin + ' nofill', delay);
        const $cp1    = dot   (g, pS, 0.02*scaleFactor, color, delay);
        const $cp2    = dot   (g, pA, 0.04*scaleFactor, color, delay);

        const $cross = drawCrosshair
            ? crossHair(g, circle.center, 'red thin2 nofill', 0.002*scaleFactor, delay)
            : [];

        return [
            ...$circle,
            ...$cp1,
            ...$cp2,
            ...$cross,
            ...$center
        ];
    }
}


export { drawTwoProng }
