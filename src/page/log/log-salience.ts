import { drawFs } from 'flo-draw';
import { Mat } from 'flo-mat';
import { distanceBetween } from 'flo-vector2d';
import { sum } from '../../utils/sum.js';
import { getBoundaryBeziersBetween } from '../../../../mat/src/cp-node/fs/get-boundary-beziers-between.js';
import { getNearestCpNode } from '../get-nearest/get-nearest-cp-node.js';
import { totalLength$ } from '../../morph/fs/total-length.js';


function logSalience(mats: Mat[]) {
    return function logSalience(g: SVGGElement, p: number[], showDelay?: number) {
        const cpNode = getNearestCpNode(mats, p).t;

        const cpNode1 = cpNode;
        const cpNode2 = cpNode.nextOnCircle;
        const bp1 = cpNode1.pointOnShape.p;
        const bp2 = cpNode2.pointOnShape.p;

        const d = distanceBetween(bp1, bp2);

        drawFs.line(g, [bp1,bp2], 'thin10 red nofill', showDelay);

        const { pss: bps, hasHoleCloser } = getBoundaryBeziersBetween(cpNode1, cpNode2);

        bps.forEach(ps => {
            drawFs.bezier(g, ps, 'thin20 red nofill', showDelay);
        })

        const s = sum(bps.map(totalLength$));

        const salience = hasHoleCloser ? Infinity : s/d;
        
        console.log(salience);
    }
}


export { logSalience }
