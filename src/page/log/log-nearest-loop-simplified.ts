import { squaredDistanceBetween } from 'flo-vector2d';
import { getShapeArea, getShapeCentroid } from 'flo-boolean';
import { beziersToSvgPathStr, Loop, Mat } from 'flo-mat';
import { drawFs } from 'flo-draw';


function logNearestLoopSimplified(
        mats: Mat[]) {
    
    return (g: SVGGElement,
            p: number[],
            showDelay = 1000) => {
    
        let bestLoop: Loop = undefined!;
        let bestDistance = Infinity;

        const loops = mats.flatMap(mat => mat.meta.loops);

        for (let loop of loops) {
            let p_ = getShapeCentroid(loop.beziers);
            let d = squaredDistanceBetween(p_, p);
            if (d < bestDistance) {
                bestLoop = loop;
                bestDistance = d;
            }
        }
            
        
        //let loop = bestLoop;
        console.log('area', getShapeArea(bestLoop.beziers));
        console.log(beziersToSvgPathStr(bestLoop.beziers));
        for (let curve of bestLoop.curves) {
            drawFs.bezier(g, curve.ps, 'thin20 red nofill', showDelay);
        }
        //console.log(loop);
    }
}


export { logNearestLoopSimplified };
