import { drawFs } from 'flo-draw';
import { Mat } from 'flo-mat';
import { getClosestBezierInMats } from '../../utils/get-closest-bezier-in-mats';


function logNearestBezier(
        mats: Mat[]) {

    return (g: SVGGElement,
            p: number[],
            showDelay = 1000) => {

        const ps = getClosestBezierInMats(mats, p);
        drawFs.bezier(g, ps, undefined, showDelay);
        console.log(ps);
    }
}


export { logNearestBezier }
