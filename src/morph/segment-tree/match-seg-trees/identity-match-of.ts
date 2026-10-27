import type { Circle } from 'flo-mat';
import type { Segment, RouteStep } from '../segment.js';
import type { SegMatchedPair } from './seg-matched-pair.js';
import { geomOf$ } from '../geom-of.js';
import { adjOf$ } from '../adj-of.js';
import { farEnd } from '../far-end.js';
import { routeSegments } from '../route-segments.js';
import { childrenOf } from './children-of.js';


/**
 * Returns the match of a tree with itself as the identity - without any
 * DTW: every route matched to itself, every child to itself.
 *
 * * the trunk is the tree's longest route (its diameter, by skeleton
 *   length)
 *
 * * a child's route runs from its farthest tip to its junction
 *
 * * all costs are 0
 *
 * * for a component without a partner, which only needs some
 *   decomposition of its own tree into routes (`buildShrinkEntries`) -
 *   matching it to itself costs more than all its glyph's real matches
 *
 * @param g the tree's segments
 * @param unit the tree's length normalization
 */
function identityMatchOf(
        g: Segment[],
        unit: number): SegMatchedPair {

    const v0 = calcFarthest(g, geomOf$(g[0]).vertS);
    const v1 = calcFarthest(g, v0);

    return identityPairOf(g, routeSegments(g, v0, v1), unit);
}


/**
 * Returns the identity match of the route (in `scope`) and, recursively,
 * of the children hanging off it.
 */
function identityPairOf(
        scope: Segment[],
        route: RouteStep[],
        unit: number): SegMatchedPair {

    const ops = childrenOf(scope, route, unit).map(c => {
        const { segs, attachV } = c;
        const tip = calcFarthest(segs, attachV);
        const sub = identityPairOf(
            segs, routeSegments(segs, tip, attachV), unit);

        return { type: 'match' as const, a: c, b: c, sub };
    });

    return {
        routeA: route, routeB: route,
        shapeCost: 0, cost: 0, sway: 0,
        ops
    };
}


/**
 * Returns the vertex of the tree farthest from `v` along it (by skeleton
 * length).
 */
function calcFarthest(
        g: Segment[],
        v: Circle): Circle {

    const adj = adjOf$(g);

    let far = v;
    let farD = 0;
    const stack: { u: Circle; from: Segment | undefined; d: number }[] =
        [{ u: v, from: undefined, d: 0 }];
    while (stack.length > 0) {
        const { u, from, d } = stack.pop()!;
        if (d > farD) { far = u; farD = d; }

        for (const s of adj.get(u) ?? []) {
            if (s === from) { continue; }
            stack.push({ u: farEnd(s, u), from: s, d: d + geomOf$(s).skelLen });
        }
    }

    return far;
}


export { identityMatchOf }
