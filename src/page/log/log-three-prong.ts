import type { Mat } from 'flo-mat';
import { getNearestThreeProng } from '../get-nearest/get-nearest-three-prong.js';
import { drawThreeProng } from '../../draw-elem/draw-three-prong.js';


/**
 * @internal
 * @param mats
 */
function logThreeProng(
        mats: Mat[]) {

    return function(g: SVGGElement, p: number[], showDelay = 1000) {
        const threeProng = getNearestThreeProng(mats, p).t;
        if (threeProng === undefined) { return; }

        console.log(threeProng);

        drawThreeProng(g, threeProng, showDelay);
    }
}

export { logThreeProng }
