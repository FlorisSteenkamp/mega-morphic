import { sum } from '../../utils/sum.js';
import { totalLength$ } from './total-length.js';


function getPolyBezierLength(
        pss: number[][][]): number {

    return sum(pss.map(totalLength$));
}


export { getPolyBezierLength }
