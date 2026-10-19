import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';

const { abs, round, PI: π } = Math;


/**
 * Returns a function returning the cost of matching child `a` (on a route
 * whose outline has length `outlineLenA`) to child `b` (outline length
 * `outlineLenB`), based on where each child sits along its route's outline
 * (`outlinePos`).
 *
 * * the cost is quadratic in the normalized mismatch, so small slides along
 *   the outline stay cheap and long-distance moves become prohibitive
 *
 * * positions are compared as outline fractions, which makes the cost both
 *   scale-invariant and mass-independent
 *
 * * the outline is closed, so the fraction mismatch is taken the short way
 *   round: a child may slide over a cap onto the other flank, priced by how
 *   far it travels
 *
 * * the fractions are rescaled by the mean normalized outline length, so
 *   for two children on the same flank the cost stays close to the old
 *   `(dA/uA - dB/uB)²` when the two lengths agree
 *
 * * dividing by per-glyph units instead is avoided: when total salience
 *   differs (e.g. M vs N) it gives children at the same route position
 *   different values, with the error worst at the route's far end
 */
function calcChildPosCost(
        unitA: number,
        unitB: number,
        w: PathCostWeights) {

    return function(
            a: SegChild,
            b: SegChild,
            outlineLenA: number,
            outlineLenB: number): number {

        const λ = (outlineLenA/unitA + outlineLenB/unitB) / 2;
        const δ = a.outlinePos/outlineLenA - b.outlinePos/outlineLenB;

        return w.position*(λ*(δ - round(δ)))**2;
    }
}


function calcAngleCost(
        w: PathCostWeights) {

    return function(a: SegChild, b: SegChild): number {
        return w.angle*abs(wrapAngle(a.angle - b.angle))/π;
    }
}


function calcDropCost(
        w: PathCostWeights) {

    return function(c: SegChild): number {
        return w.delFloor + w.del*c.material;
    }
}


export {
    calcChildPosCost, calcAngleCost, calcDropCost
}
