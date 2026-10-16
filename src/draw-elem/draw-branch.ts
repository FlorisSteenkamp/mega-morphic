import type { CpNode } from 'flo-mat';
import { getMatCurveToNext, isTerminating } from 'flo-mat';
import { drawBeziersAsSinglePath } from '../draw/draw-beziers-as-single-path.js';


/** @internal */
function drawBranch(
        g: SVGGElement,
        branch: CpNode[],
        classes = 'thin5 purple nofill') {

    const pss: number[][][] = [];
    for (const cpNode of branch) {
        if (isTerminating(cpNode)) { continue; }
        const beziers = getMatCurveToNext(cpNode);
        if (!beziers) { continue; }
        pss.push(...beziers);
    }

    return drawBeziersAsSinglePath(g, pss, classes);
}


export { drawBranch }
