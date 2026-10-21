import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { OutlineFrame } from './outline-len-of.js';
import type { RouteWarp } from './route-warp-of.js';
import type { RouteFeatures } from './route-features-of.js';
import { wrapAngle } from '../../intrinsic-skeleton/wrap-angle.js';
import { MAX_CROSS } from './consts.js';

const { abs, round, floor, min, PI: π } = Math;


/**
 * Returns a function returning the cost of matching child `a` (on a route
 * whose outline has length `outlineLenA`) to child `b` (outline length
 * `outlineLenB`), based on where each child sits along its route's outline
 * (`outlinePos`) - the absolute (whole-outline) position price.
 *
 * * catches drift: the spacing between consecutive matches
 *   (`calcSpacingCost`) is local, so moderate errors leaning the same way
 *   can add up along a chain of matches unseen
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
 * Returns a function returning the cost of the link from matched pair `p`
 * to the next matched pair `q` around the outlines (`frameA`, `frameB`):
 * how differently far apart they are.
 *
 * * `undefined` is the anchor at the routes' start (outline position 0,
 *   corresponded by construction): `p` undefined links from it to the
 *   first match, `q` undefined from the last match back to it - so each
 *   match is placed relative to its neighbouring matches (each match resets
 *   the reference)
 *
 * * the routes' end anchors (the middle of their end caps, also
 *   corresponded) split the links passing them: a link passing either end
 *   anchor is priced as its two parts, to the anchor and on from it, in
 *   both glyphs (`calcGapFracs`) - so no stretch between landmarks is longer
 *   than half the outline, and drift cannot carry past the far end
 *
 * * gaps are measured along the skeleton (`calcSkelGapFracs` - children at
 *   the same fork are `0` apart whatever their side), as route fractions
 *   rescaled by the mean normalized route length into glyph units; whether
 *   a link passes the end anchor comes from the outline order
 *   (`calcGapFracs`); each (part of a) link costs
 *   `w.spacing·e / (g + r̄)`, where `e` is the gaps' difference, `g` the
 *   smaller gap and `r̄` the moved child pair's mean normalized attach radius
 *   (of `q`, or of `p` for the link back to the start):
 *   * linear - the visual cost of a move grows with how far it goes (a
 *     square would make small but visible slides nearly free and let
 *     outliers dominate)
 *   * relative to the gap where gaps are large - a slide within a long
 *     stretch is cheap, while moving a child that sits right at a landmark
 *     (a fork, a tip, another match, an anchor) away from it is not
 *   * floored by the stroke width where gaps are small - a difference finer
 *     than the stroke is not visible
 *   * relative to the SMALLER gap, so it grows without bound with the
 *     move (a mean would grow with the error itself and cap the cost)
 *   * gaps of opposite sign straddle an anchor - the child changed sides of
 *     it - and are relative to no gap at all (only the stroke-width floor),
 *     so crossing an anchor is cheap only right at it
 *
 * * never negative, and `0` without any match
 */
function calcSpacingCost(
        unitA: number,
        unitB: number,
        w: PathCostWeights) {

    return function(
            p: [SegChild, SegChild] | undefined,
            q: [SegChild, SegChild] | undefined,
            frameA: OutlineFrame,
            frameB: OutlineFrame): number {

        const moved = q ?? p;
        if (moved === undefined) { return 0; }
        const [a, b] = moved;

        const λ = (frameA.routeLen/unitA + frameB.routeLen/unitB) / 2;
        const r = (a.attachV.radius/unitA + b.attachV.radius/unitB) / 2;

        // whether the link passes the end anchor: from the outline order
        const passesEnd =
            calcGapFracs(p?.[0], q?.[0], frameA).passesEnd ||
            calcGapFracs(p?.[1], q?.[1], frameB).passesEnd;

        // the gaps themselves: along the skeleton
        const gsA = calcSkelGapFracs(p?.[0], q?.[0], frameA);
        const gsB = calcSkelGapFracs(p?.[1], q?.[1], frameB);

        const cost = (fA: number, fB: number) =>
            w.spacing*calcRelMismatch(λ*fA, λ*fB, r);

        return passesEnd
            ? cost(gsA.toEnd, gsB.toEnd) + cost(gsA.fromEnd, gsB.fromEnd)
            : cost(gsA.gap, gsB.gap);
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
 * * likewise b's position onto a's route; the cost is the mean of both,
 *   times `w.position`
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

        return w.position*(shiftA + shiftB)/2;
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


/**
 * Returns the mismatch of two gaps relative to the smaller one, floored by
 * `r` (`0` when they straddle an anchor, i.e. differ in sign).
 *
 * @param gA the gap in A (glyph units)
 * @param gB the gap in B (glyph units)
 * @param r the stroke-width floor (glyph units)
 */
function calcRelMismatch(
        gA: number,
        gB: number,
        r: number): number {

    // the smaller gap, not the mean: the mean grows with the error itself,
    // capping the ratio at 2 - any move, however far, would cost at most
    // 4·w
    const g = gA*gB > 0 ? min(abs(gA), abs(gB)) : 0;

    return abs(gA - gB)/(g + r);
}


/**
 * Returns the outline fractions of the link from child `p` on to child `q`
 * (`undefined` = the start anchor at outline position 0):
 *
 * * `gap` - the whole link: forward between two children; from the start
 *   anchor forward, or backward (crossing the start) to a child within
 *   `MAX_CROSS` before it; likewise back to the start anchor
 *
 * * `passesEnd` - whether the link passes the end anchor
 *
 * * `toEnd` / `fromEnd` - the link split at the end anchor (the signed
 *   short way to it, then the rest - negative when the link stops short of
 *   it, so the other glyph's passing reads as a crossing)
 *
 * @param p the child the link starts at
 * @param q the child the link ends at
 * @param frame the route's outline
 */
function calcGapFracs(
        p: SegChild | undefined,
        q: SegChild | undefined,
        frame: OutlineFrame) {

    const { len, end } = frame;
    const fp = p === undefined ? 0 : p.outlinePos/len;
    const fq = q === undefined ? 0 : q.outlinePos/len;

    const gap =
        p === undefined ? (fq >= 1 - MAX_CROSS ? fq - 1 : fq)
        : q === undefined ? (fp < MAX_CROSS ? -fp : 1 - fp)
        : fq - fp - floor(fq - fp);

    const toEnd = p === undefined ? end : end - fp - round(end - fp);
    const fromEnd = gap - toEnd;

    return { gap, toEnd, fromEnd, passesEnd: toEnd > 0 && toEnd <= gap };
}


/**
 * Returns the skeleton fractions (of the route's length) of the link from
 * child `p` on to child `q` (`undefined` = the start anchor, at `dist` 0):
 *
 * * `gap` - the signed change in `dist` - children at the same fork have
 *   gap `0` whichever side of the route they hang off (along the outline
 *   they would be a whole cap apart)
 *
 * * `toEnd` / `fromEnd` - the link split at the route's end (`dist` = the
 *   route length)
 *
 * @param p the child the link starts at
 * @param q the child the link ends at
 * @param frame the route's outline
 */
function calcSkelGapFracs(
        p: SegChild | undefined,
        q: SegChild | undefined,
        frame: OutlineFrame) {

    const { routeLen } = frame;
    const dp = p === undefined ? 0 : p.dist/routeLen;
    const dq = q === undefined ? 0 : q.dist/routeLen;

    return { gap: dq - dp, toEnd: 1 - dp, fromEnd: dq - 1 };
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
    calcChildPosCost, calcSpacingCost, calcWarpPosCost, calcAngleCost,
    calcDropCost
}
