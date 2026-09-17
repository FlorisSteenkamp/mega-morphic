import { totalLength } from 'flo-bezier3';
import { sum } from '../../utils/sum.js';


function getPolyBezierLength(
        pss: number[][][]): number {

    return sum(pss.map(ps => totalLength(ps)));
}


export { getPolyBezierLength }
