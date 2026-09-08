import { getClosestBezierInMats } from '../../utils/get-closest-bezier-in-mats.js';
import { drawFs } from 'flo-draw';
import { curvature, evalDeCasteljau, evalDeCasteljauDd, getCurvatureExtrema, getCurvatureExtremaDd, normal } from 'flo-bezier3';
import { toLength, translate } from 'flo-vector2d';
import { Mat } from 'flo-mat';


function logK(mats: Mat[]) {
    return function logK(g: SVGGElement, p: number[], showDelay?: number) {
        const ps = getClosestBezierInMats(mats, p);

        const count = 10;
        const ts = [...Array.from(Array(count).keys()),count].map(t => t/count);

        console.log(ts.map(t => curvature(ps,t)));
        const extrema = getCurvatureExtrema(ps);
        const { minima, maxima } = extrema;
        const mimimaPs = minima.map(t => evalDeCasteljauDd(ps, [0,t]).map(c => c[1]));
        const maximaPs = maxima.map(t => evalDeCasteljauDd(ps, [0,t]).map(c => c[1]));

        console.log(mimimaPs);
        console.log(maximaPs);

        for (const p of mimimaPs) {
            drawFs.dot(g,p,1,'pink',showDelay);
        }
        for (const p of maximaPs) {
            drawFs.dot(g,p,1,'blue',showDelay);
        }

        ts.map(t => {
            const k = curvature(ps,t);
            const p = evalDeCasteljau(ps,t);
            const n = toLength(normal(ps,t),k*5000);
            drawFs.line(g, [p,translate(p,n)], 'red thin2', showDelay);
        });
        const extremaDd = getCurvatureExtremaDd(ps);
        drawFs.bezier(g, ps, undefined, showDelay);
    }
}


export { logK }
