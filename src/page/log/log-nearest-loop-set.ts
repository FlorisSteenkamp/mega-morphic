import type { Loop } from 'flo-boolean';
import type { Mat } from 'flo-mat';
import { drawFs } from 'flo-draw';
import { squaredDistanceBetweenPointAndLineSegment } from 'flo-vector2d';


function logNearestLoopSet(
        mats: Mat[]) {

    return (g: SVGGElement,
            p: number[],
            showDelay = 1000) => {
    
        let bestDistance = Infinity;
        let bestLoops: Loop[] = undefined!;

        const loopss = mats.map(mat => mat.meta.loops)

        for (let loops of loopss) {
            for (let loop of loops) {
                for (let curve of loop.curves) {
                    let ps = curve.ps;
                    let l = [ps[0], ps[ps.length - 1]];
                    
                    let d = squaredDistanceBetweenPointAndLineSegment(p, l);
                    
                    if (d < bestDistance) {
                        bestDistance = d;
                        bestLoops = loops;
                    }
                }
            }
        }
        
        for (let loop of bestLoops) {
            for (let curve of loop.curves) {
                drawFs.bezier(g, curve.ps, undefined, showDelay);
            }
        }

        console.log(bestLoops);
        //console.log(bestLoops.map(
        //    loop => loop.beziers.map(ps => length([0,1],ps))
        //))
    }
}


export { logNearestLoopSet };
