import { fromTo, getTAtLength, lineToQuadratic } from 'flo-bezier3';
import { clamp } from '../../utils/clamp.js';


/**
 * The piece of the line or quadratic bezier between arc lengths `s0` and
 * `s1` (measured from its start), as a quadratic (lines are degree-elevated).
 */
function quadSection(
        ps: number[][],
        s0: number,
        s1: number): number[][] {

    const t0 = clamp(getTAtLength(ps, s0), 0, 1);
    const t1 = clamp(getTAtLength(ps, s1), 0, 1);
    const section = fromTo(ps, t0, t1);

    return section.length === 2 ? lineToQuadratic(section) : section;
}


export { quadSection }
