import type { Mat } from 'flo-mat';
import { getNearestTwoProng } from '../get-nearest/get-nearest-two-prong.js';
import { drawTwoProng } from '../../draw-elem/draw-two-prong.js';


function logTwoProng(
        mats: Mat[]) {
            
    return (g: SVGGElement,
            p: number[],
            showDelay = 1000) => {
                
        const twoProng = getNearestTwoProng(mats, p).t;

        console.log(twoProng);

        drawTwoProng(false)(g, twoProng, showDelay);
    }
}


export { logTwoProng }
