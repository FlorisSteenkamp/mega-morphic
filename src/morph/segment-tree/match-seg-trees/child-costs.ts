import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';

const { abs, PI: π } = Math;


// Quadratic in the normalized mismatch: small slides along the trunk stay
// cheap, long-distance moves get prohibitive. Positions are compared as
// ROUTE FRACTIONS (scale-invariant AND mass-independent - per-glyph units
// skew same-position children when total salience differs, e.g. M vs N,
// worst exactly at route ends), rescaled by the mean normalized route
// length so this reduces to the old (dA/uA - dB/uB)² when the two agree.
function posCostOf(
        unitA: number,
        unitB: number,
        w: PathCostWeights) {

    return function(
            a: SegChild, b: SegChild,
            routeLenA: number, routeLenB: number): number {

        const λ = (routeLenA/unitA + routeLenB/unitB) / 2;

        return w.position*(λ*(a.dist/routeLenA - b.dist/routeLenB))**2;
    }
}


function angleCostOf(
        w: PathCostWeights) {

    return function(a: SegChild, b: SegChild): number {
        return w.angle*abs(wrapAngle(a.angle - b.angle))/π;
    }
}


function dropCostOf(
        w: PathCostWeights) {

    return function(c: SegChild): number {
        return w.delFloor + w.del*c.material;
    }
}


// terminal (seam) children only match terminal children - regular ones
// only regular (side/seam sequences correspond)
const terminalGated = (a: SegChild, b: SegChild): boolean =>
    (a.terminal === undefined) !== (b.terminal === undefined);


// Per-side sequences in sleeve-boundary order: regular children by dist,
// then that side's seam terminals in fork-sweep order (end fork → out
// side's tail; start fork → back side's tail).
const seqOf = (ch: SegChild[], side: 1 | -1): SegChild[] => [
    ...ch.filter(c => c.side === side && c.terminal === undefined)
        .sort((x, y) => side*(x.dist - y.dist)),
    ...ch.filter(c => c.terminal === (side === 1 ? 'end' : 'start'))
        .sort((x, y) => x.sweep! - y.sweep!)
];


export { posCostOf, angleCostOf, dropCostOf, terminalGated, seqOf }
