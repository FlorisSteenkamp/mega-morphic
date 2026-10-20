import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { OutlineFrame } from './outline-len-of.js';
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
    calcChildPosCost, calcSpacingCost, calcAngleCost, calcDropCost
}
