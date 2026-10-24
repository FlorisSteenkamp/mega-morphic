import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { RouteWarp } from './route-warp-of.js';
import type { RouteFeatures } from './route-features-of.js';
import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';

const { abs, round, min, max, PI: π } = Math;


/**
 * Returns a function returning the cost of matching child `a` (on a route
 * whose outline has length `outlineLenA`) to child `b` (outline length
 * `outlineLenB`), based on where each child sits along its route's outline
 * (`outlinePos`) - the absolute (whole-outline) position price.
 *
 * * the cheap estimate's position price (`cheapChildCost`) - the full
 *   alignment prices positions through the routes' warp
 *   (`calcWarpPosCost`)
 *
 * * linear in the normalized mismatch - the visual cost of a move grows
 *   with how far it goes
 *
 * * positions are compared as outline fractions, which makes the cost both
 *   scale-invariant and mass-independent
 *
 * * the outline is closed, so the fraction mismatch is taken the short way
 *   round: a child may slide over a cap onto the other flank, priced by how
 *   far it travels
 *
 * * the fractions are rescaled by the mean normalized outline length, so
 *   for two children on the same flank the mismatch stays close to
 *   `|dA/uA - dB/uB|` when the two lengths agree
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

        return w.position*λ*abs(δ - round(δ));
    }
}


/**
 * Returns a function returning the position cost of matching child `a` to
 * child `b` through the correspondence of their routes (`warp`): how far
 * each lands from the other, in units of the local feature spacing.
 *
 * * a's position is mapped through the warp onto b's route, and counted in
 *   feature intervals (forks and route ends) from b (`calcFeatureShift`) -
 *   landing on the neighbouring feature costs `1`, crossing two `2`, a
 *   slide within the same stretch only its fraction
 *
 * * likewise b's position onto a's route; the cost is the larger of both,
 *   times `w.position` - a move is as visible as it is in the glyph where
 *   it crosses the most of a stretch (a child leaving a tip that sits at
 *   the end of a short stretch in one glyph but of a long one in the
 *   other is not cheap for it)
 *
 * * features closer together than the child's stroke width are one (a
 *   double fork) - finer differences are not visible
 *
 * * children hanging off opposite sides of their routes are measured round
 *   the nearer route end (the outline connects them only there) - cheap
 *   near a tip, prohibitive mid-route, where the morph would swing the child
 *   across its parent
 *
 * * linear - the visual cost of a move grows with how far it goes
 */
function calcWarpPosCost(
        w: PathCostWeights) {

    return function(
            a: SegChild,
            b: SegChild,
            warp: RouteWarp,
            featsA: RouteFeatures,
            featsB: RouteFeatures): number {

        const { len: lenA } = featsA;
        const { len: lenB } = featsB;

        // hanging off opposite sides of their routes, the two children are
        // connected along the outline only around a route end - swinging
        // across the route instead would cross it in the morph
        const viaEnd = a.terminal === undefined && b.terminal === undefined &&
            a.side !== b.side;

        const shiftB = calcFeatureShift(
            warp.mapAB(a.dist/lenA)*lenB, b, featsB, viaEnd);
        const shiftA = calcFeatureShift(
            warp.mapBA(b.dist/lenB)*lenA, a, featsA, viaEnd);

        return w.position*max(shiftA, shiftB);
    }
}


/**
 * Returns how many feature intervals the point `x` (a distance along the
 * route) lies from child `c`: the difference of their feature coordinates
 * (`calcFeatureCoord`) - so a move crossing several forks counts each
 * stretch it crosses, and a slide within a stretch only its fraction.
 *
 * * features closer together than `c`'s stroke width (its attach radius)
 *   are one feature (a double fork), so no stretch is shorter than that
 *
 * * `viaEnd` (the point is on the other side of the route): the shortest
 *   way round either route end instead - the intervals from each to the end
 *
 * @param x the point, as a distance along the route
 * @param c the child
 * @param feats the route's features
 * @param viaEnd `true` if the point lies on the other side of the route
 */
function calcFeatureShift(
        x: number,
        c: SegChild,
        feats: RouteFeatures,
        viaEnd: boolean): number {

    const fs = mergeFeatures(feats.dists, c.attachV.radius);
    const fx = calcFeatureCoord(x, fs);
    const fc = calcFeatureCoord(c.dist, fs);

    if (!viaEnd) { return abs(fx - fc); }

    const last = fs.length - 1;

    return min(fx + fc, (last - fx) + (last - fc));
}


/**
 * Returns the features merged where closer together than `r` (each run of
 * close features becomes its mean - the route's ends stay put).
 *
 * @param dists the features' distances along the route, ascending
 * @param r the merge distance
 */
function mergeFeatures(
        dists: number[],
        r: number): number[] {

    const last = dists.length - 1;
    const out: number[] = [];
    let run: number[] = [];
    for (let k = 0; k <= last; k++) {
        const d = dists[k];
        if (run.length > 0 && d - run[run.length - 1] >= r) {
            out.push(calcRunPos(run, dists[0], dists[last]));
            run = [];
        }
        run.push(d);
    }
    out.push(calcRunPos(run, dists[0], dists[last]));

    return out;
}


/**
 * Returns the position of a merged run of features: a route end if it holds
 * one, else its mean.
 */
function calcRunPos(
        run: number[],
        start: number,
        end: number): number {

    if (run[0] === start) { return start; }
    if (run[run.length - 1] === end) { return end; }

    return run.reduce((s, d) => s + d, 0)/run.length;
}


/**
 * Returns the feature coordinate of the distance `x` along the route: the
 * index of the feature interval it lies in plus its fraction across it
 * (`k` exactly at feature `k`).
 *
 * @param x the distance along the route
 * @param fs the (merged) features' distances, ascending
 */
function calcFeatureCoord(
        x: number,
        fs: number[]): number {

    const last = fs.length - 1;
    if (x <= fs[0]) { return 0; }
    if (x >= fs[last]) { return last; }

    let k = 0;
    while (fs[k + 1] < x) { k++; }

    return k + (x - fs[k])/(fs[k + 1] - fs[k]);
}


function calcAngleCost(
        w: PathCostWeights) {

    return function(a: SegChild, b: SegChild): number {
        return w.angle*abs(wrapAngle(a.angle - b.angle))/π;
    }
}


/**
 * Returns a function returning the size factor of a child pair: the mean
 * drop price of the two children's material, `del × (mA + mB)/2`.
 *
 * * the placement terms of a match (position, angle, sway) are scaled by
 *   it, so they are priced in the same units as dropping - a fraction of
 *   what the branches are worth - and a small branch and a big one are
 *   judged alike by how well they fit relative to their size
 */
function calcSizeFactor(
        w: PathCostWeights) {

    return function(a: SegChild, b: SegChild): number {
        return w.del*(a.material + b.material)/2;
    }
}


function calcDropCost(
        w: PathCostWeights) {

    return function(c: SegChild): number {
        return w.delFloor + w.del*c.material;
    }
}


export {
    calcChildPosCost, calcWarpPosCost, calcAngleCost, calcSizeFactor,
    calcDropCost
}
