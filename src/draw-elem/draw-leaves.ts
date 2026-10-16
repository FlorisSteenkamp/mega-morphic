import type { CpNode } from 'flo-mat';
import { drawFs } from 'flo-draw';
import { drawDisk } from '../draw/draw-disk.js';
import { getAllOnCircle } from 'flo-mat';


/** @internal */
function drawLeaves(
        g: SVGGElement,
        leaves: CpNode[],
        delay = 0,
        scaleFactor = 1) {    

    const $elems: SVGElement[] = [];
    const { line, dot, circle: drawCircle } = drawFs;

    for (const cpNode of leaves) {
        const cp = cpNode.pointOnShape;
        const { circle } = cp;
        const { center: c } = circle;

        const $center = drawDisk(g, c, '0.5%', 'pinker thin5 nofill');

        const poss = getAllOnCircle(cpNode)
            .map(cpNode => cpNode.pointOnShape);

        const $ls: SVGElement[] = [];
        const $cps: SVGElement[] = [];
        for (let i=0; i<poss.length; i++) {
            const p = poss[i].p;
            $cps.push(...dot(g, p, 0.01*(i+1)*scaleFactor, 'pinker', delay));
            $ls.push(...line(g, [p, c], 'thin5 red', delay));
        }
        
        const $circle = drawCircle(g, circle, 'thin10 deeppink nofill', delay);
        // const $cp = dot(g, p, 0.005*scaleFactor, 'pinker', delay);

        $elems.push(...[
            ...$circle,
            ...$cps,
            ...$ls,
            ...$center
        ]);
    }
    
    return $elems;
}


export { drawLeaves }
