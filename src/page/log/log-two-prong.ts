import type { Mat } from 'flo-mat';
import { getRealProngCount } from 'flo-mat';
import { getNearestVertex } from '../get-nearest/get-nearest-vertex.js';
import { drawTwoProng } from '../../draw-elem/draw-two-prong.js';


function logTwoProng(
        mats: Mat[]) {
            
    return (g: SVGGElement,
            p: number[],
            showDelay = 1000) => {
                
        const twoProng = getNearestVertex(
            mats, p, cpNode => getRealProngCount(cpNode) === 2
        ).t;

        console.log(twoProng);

        drawTwoProng(false)(g, twoProng, showDelay);
    }
}


export { logTwoProng }
