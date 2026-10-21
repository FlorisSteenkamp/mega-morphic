import type { RouteStep } from '../segment.js';
import { composeRouteGeom } from '../compose-segs.js';
import { alignBranches } from '../../align-branches.js';


/**
 * The correspondence of two routes along their length, as monotone maps
 * between route fractions.
 */
interface RouteWarp {
    /** route A's fraction → route B's corresponding fraction */
    readonly mapAB: (uA: number) => number;
    /** route B's fraction → route A's corresponding fraction */
    readonly mapBA: (uB: number) => number;
}


/**
 * Returns the correspondence of route `rA` with route `rB` along their
 * length (`RouteWarp`): the morph's own feature-aligned warp of the two
 * routes (`alignBranches`, without anchors).
 *
 * * a gapless monotone DTW on the radius and turning profiles, regularized
 *   toward proportional arc length - features (corners, swellings) pull the
 *   correspondence locally, featureless stretches stay proportional
 *
 * * the same correspondence the morph draws the routes with, so the matcher
 *   places children where the morph will carry them
 *
 * * both ends correspond
 *
 * @param rA the route in A
 * @param rB the route in B
 * @param unitA tree A's length normalization
 * @param unitB tree B's length normalization
 */
function routeWarpOf(
        rA: RouteStep[],
        rB: RouteStep[],
        unitA: number,
        unitB: number): RouteWarp {

    const { skelPss: bzA, radii: rdA } = composeRouteGeom(rA);
    const { skelPss: bzB, radii: rdB } = composeRouteGeom(rB);
    const { usA, usB } = alignBranches(bzA, rdA, bzB, rdB, [], unitA, unitB);

    const pairs = usA.map((uA, k) => [uA, usB[k]]);

    return {
        mapAB: fn_interpolate(pairs, 0, 1),
        mapBA: fn_interpolate(pairs, 1, 0)
    };
}


/**
 * Returns a function interpolating a monotone polyline of `pairs`, from
 * coordinate `from` to coordinate `to` of each pair.
 *
 * * pairs sharing a `from` value (a run collapsing onto a point of the
 *   other route) collapse onto their mean `to`
 *
 * * beyond the polyline's ends, the end values hold
 *
 * @param pairs the polyline's points, in increasing order of both coordinates
 * @param from the index of the input coordinate
 * @param to the index of the output coordinate
 */
function fn_interpolate(
        pairs: number[][],
        from: 0 | 1,
        to: 0 | 1) {

    const xs: number[] = [];
    const ys: number[] = [];
    let n = 0;
    for (const p of pairs) {
        const x = p[from];
        const y = p[to];
        if (xs.length > 0 && x === xs[xs.length - 1]) {
            // a run of equal x: running mean of its y
            n++;
            ys[ys.length - 1] += (y - ys[ys.length - 1])/n;
        } else {
            xs.push(x);
            ys.push(y);
            n = 1;
        }
    }

    return function(x: number): number {
        if (x <= xs[0]) { return ys[0]; }
        const last = xs.length - 1;
        if (x >= xs[last]) { return ys[last]; }

        // binary search for the bracketing points
        let lo = 0;
        let hi = last;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (xs[mid] <= x) { lo = mid; } else { hi = mid; }
        }
        const s = (x - xs[lo])/(xs[hi] - xs[lo]);

        return ys[lo] + s*(ys[hi] - ys[lo]);
    }
}


export { routeWarpOf }
export type { RouteWarp }
