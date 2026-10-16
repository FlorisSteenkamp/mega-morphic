import { fromTo, getTAtLength, toCubic } from 'flo-bezier3';
import { clamp } from '../../utils/clamp.js';


/**
 * The piece of the bezier between arc lengths `s0` and `s1` (measured from
 * its start), as a cubic.
 */
function cubicSection(
        ps: number[][],
        s0: number,
        s1: number): number[][] {

    const t0 = clamp(getTAtLength(ps, s0), 0, 1);
    const t1 = clamp(getTAtLength(ps, s1), 0, 1);

    return toCubic(fromTo(ps, t0, t1));
}


export { cubicSection }
