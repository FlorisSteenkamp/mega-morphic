import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';

const { abs, PI: π } = Math;


/**
 * Returns a function returning the cost of matching child `a` (on a route of
 * length `routeLenA`) to child `b` (on a route of length `routeLenB`), based on
 * where each child sits along its route.
 *
 * * the cost is quadratic in the normalized mismatch, so small slides along
 *   the trunk stay cheap and long-distance moves become prohibitive
 * 
 * * positions are compared as route fractions, which makes the cost both
 *   scale-invariant and mass-independent
 * 
 * * the fractions are rescaled by the mean normalized route length, so the
 *   cost reduces to the old `(dA/uA - dB/uB)²` when the two lengths agree
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
            routeLenA: number,
            routeLenB: number): number {

        const λ = (routeLenA/unitA + routeLenB/unitB) / 2;

        return w.position*(λ*(a.dist/routeLenA - b.dist/routeLenB))**2;
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


/**
 * Returns `true` if `a` and `b` may not be matched because exactly one of them
 * is a terminal (seam) child.
 *
 * * terminal children only match terminal children and regular ones only
 *   regular ones, so the side and seam sequences correspond
 */
function isTerminalGated(
        a: SegChild,
        b: SegChild): boolean {

    return (a.terminal === undefined) !== (b.terminal === undefined);
}


export {
    calcChildPosCost, calcAngleCost, calcDropCost, isTerminalGated
}
