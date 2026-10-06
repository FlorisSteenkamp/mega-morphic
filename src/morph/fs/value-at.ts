import { clamp } from '../../utils/clamp.js';
import { knotIdxAt } from './knot-idx-at.js';

const { min } = Math;


/** Piecewise-linear value over `knots` at normalized position `u`. */
function valueAt(
        vals: number[],
        knots: number[],
        u: number): number {

    const j = knotIdxAt(knots, u);
    const span = knots[j + 1] - knots[j];
    const f = span <= 0 ? 0 : clamp((u - knots[j]) / span, 0, 1);

    return vals[j]*(1 - f) + vals[min(j + 1, vals.length - 1)]*f;
}


export { valueAt }
