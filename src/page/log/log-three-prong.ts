import type { Mat } from 'flo-mat';
import { getRealProngCount } from 'flo-mat';
import { getNearestVertex } from '../get-nearest/get-nearest-vertex.js';
import { drawThreeProng } from '../../draw-elem/draw-three-prong.js';


/**
 * @internal
 * @param mats
 */
function logThreeProng(
        mats: Mat[]) {

    return function(g: SVGGElement, p: number[], showDelay = 1000) {
        const threeProng = getNearestVertex(
            mats, p, cpNode => getRealProngCount(cpNode) >= 3
        ).t;
        if (threeProng === undefined) { return; }

        console.log(threeProng);

        drawThreeProng(g, threeProng, showDelay);
    }
}

export { logThreeProng }
