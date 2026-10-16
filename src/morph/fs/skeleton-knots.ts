import { length$ } from './length.js';
import { sum } from '../../utils/sum.js';


/**
 * Returns the normalized cumulative arc-length knots of a skeleton
 * bezier list.
 */
function calcSkelCumKnots(
        pss: number[][][]): number[] {

    const lens = pss.map(length$);
    const total = sum(lens);

    const knots = [0];
    let cum = 0;
    for (const l of lens) {
        cum += l;
        knots.push(total > 0 ? cum/total : 0);
    }

    knots[knots.length - 1] = 1;

    return knots;
}


export { calcSkelCumKnots }
