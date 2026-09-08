import type { CpNode } from 'flo-mat';
import { getMatCurveToNext, isTerminating } from 'flo-mat';
import { drawBeziersAsSinglePath } from '../draw/draw-beziers-as-single-path.js';


/** @internal */
function drawBranch(
        g: SVGGElement,
        branch: CpNode[],
        classes = 'thin5 purple nofill',
        delay = 0,
        scaleFactor = 1) {


    const $svgs: SVGElement[] = [];

    const pss: number[][][] = [];
    for (const cpNode of branch) {
        if (isTerminating(cpNode)) { continue; }
        const bezier = getMatCurveToNext(cpNode);
        if (!bezier) { continue; }
        pss.push(bezier);
    }
    
    $svgs.push(...drawBeziersAsSinglePath(g, pss, classes, delay));

    return $svgs;
}


export { drawBranch }
