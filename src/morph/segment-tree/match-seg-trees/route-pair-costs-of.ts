import type { Circle } from 'flo-mat';
import type { RouteStep, Segment } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import { sampleSegTree, sampleSegTreeEndingAt } from '../sample-seg-tree.js';
import { productDtw } from '../product-dtw.js';
import { lenOfSegs$ } from '../len-of.js';
import { sampleCountFor } from './sub-dtw-of.js';
import { routeEndsOf } from './outline-len-of.js';


/**
 * Returns the shape and sway costs of aligning exactly route `rA` with
 * route `rB` (start with start, end with end), as the trunk's product DTW
 * prices a route pair - but restricted to the two routes, so any route pair
 * can be priced, not only the DTW's winners.
 *
 * * `undefined` if the routes can't be aligned end to end (including when
 *   either has no length)
 *
 * @param rA the route in A
 * @param rB the route in B
 * @param unitA tree A's length normalization
 * @param unitB tree B's length normalization
 * @param δA tree A's trunk-level sample spacing
 * @param δB tree B's trunk-level sample spacing
 * @param weights the path cost weights
 * @param swayW local-sway measurement factor
 * @param rotB the rotation taking B's directions into A's frame (for a
 * child pair, the difference of the parents' directions at the attach
 * vertices - sway is measured relative to the parent, as `subDtwOf` does;
 * `0` for the trunk)
 */
function routePairCostsOf(
        rA: RouteStep[],
        rB: RouteStep[],
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        swayW: number,
        rotB: number): { shapeCost: number; swayCost: number } | undefined {

    // no route: an end variant outside the routes' segments (variants are
    // looked up in the whole tree - `endVariantsOf`)
    if (rA.length === 0 || rB.length === 0) { return undefined; }

    const segsA = rA.map(st => st.seg);
    const segsB = rB.map(st => st.seg);
    const [startA, endA] = routeEndsOf(rA);
    const [startB, endB] = routeEndsOf(rB);
    const lenA = lenOfSegs$(segsA);
    const lenB = lenOfSegs$(segsB);

    // a route of no length (e.g. a degenerate tip sitting on its fork) has
    // nothing to align - and can't be sampled (zero spacing)
    if (!(lenA > 0) || !(lenB > 0)) { return undefined; }

    const ssgA = sampleSegTree(
        segsA, unitA, sampleCountFor(lenA, δA), startA);
    const ssgB = sampleSegTree(
        segsB, unitB, sampleCountFor(lenB, δB), startB);
    // φ only feeds the sway measurement
    const ssgBInA = { ...ssgB, φ: ssgB.φ.map(φ => φ + rotB) };

    const c = productDtw(ssgA, ssgBInA, weights, swayW).candidates
        .find(c => c.endA === endA && c.endB === endB);

    return c === undefined
        ? undefined
        : { shapeCost: c.shapeCost, swayCost: c.swayCost };
}


/** a route pair by its ends: `[startA, endA, startB, endB]` */
type RouteEnds = readonly [Circle, Circle, Circle, Circle];

/** route-pair costs by `startA`, `startB`, `endA`, `endB` */
type RouteCostsTable = Map<Circle, Map<Circle, Map<Circle, Map<Circle,
    { shapeCost: number; swayCost: number } | undefined>>>>;


/**
 * Returns the costs of many trunk route pairs (`routePairCostsOf` each,
 * `rotB` 0), sharing the work: one DTW per start pair, over the union of
 * its routes in each tree (sampled from the start, every route end an end
 * - `sampleSegTreeEndingAt`), read off at each route pair's ends.
 *
 * * along each route, the union's samples are (up to the sample spacing's
 *   rounding) the route's own, and its DP the route pair's: a route pair's
 *   only path in the union from the start pair to its ends is its own
 *
 * * as a lookup by start A, start B, end A, end B (`getRouteCosts`)
 *
 * @param pairs the route pairs
 * @param routeOfA the route between two vertices of tree A
 * @param routeOfB the route between two vertices of tree B
 * @param unitA tree A's length normalization
 * @param unitB tree B's length normalization
 * @param δA tree A's trunk-level sample spacing
 * @param δB tree B's trunk-level sample spacing
 * @param weights the path cost weights
 * @param swayW local-sway measurement factor
 */
function calcRoutePairsCosts(
        pairs: RouteEnds[],
        routeOfA: (v0: Circle, v1: Circle) => RouteStep[],
        routeOfB: (v0: Circle, v1: Circle) => RouteStep[],
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        swayW: number): RouteCostsTable {

    // the end pairs wanted per start pair
    const byStarts = new Map<Circle, Map<Circle, [Circle, Circle][]>>();
    for (const [startA, endA, startB, endB] of pairs) {
        byStarts.getOrInsert(startA, new Map()).getOrInsert(startB, [])
            .push([endA, endB]);
    }

    const table: RouteCostsTable = new Map();
    for (const [startA, byStartB] of byStarts) {
        for (const [startB, ends] of byStartB) {
            const costs = table.getOrInsert(startA, new Map())
                .getOrInsert(startB, new Map());
            const priced = priceFromStarts(
                startA, startB, ends, routeOfA, routeOfB,
                unitA, unitB, δA, δB, weights, swayW);
            for (const [endA, endB] of ends) {
                costs.getOrInsert(endA, new Map())
                    .set(endB, priced(endA, endB));
            }
        }
    }

    return table;
}


/**
 * Returns the costs of the route pairs from `startA`, `startB` to each of
 * the end pairs, by one DTW over the union of their routes (see
 * `calcRoutePairsCosts`) - as `routePairCostsOf` would price each: a route
 * without length can't be aligned (`undefined`).
 */
function priceFromStarts(
        startA: Circle,
        startB: Circle,
        ends: [Circle, Circle][],
        routeOfA: (v0: Circle, v1: Circle) => RouteStep[],
        routeOfB: (v0: Circle, v1: Circle) => RouteStep[],
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        swayW: number): (endA: Circle, endB: Circle) => {
            shapeCost: number; swayCost: number } | undefined {

    const isAlignable = (r: RouteStep[]) =>
        r.length > 0 && lenOfSegs$(r.map(st => st.seg)) > 0;

    const endsA = new Set<Circle>();
    const endsB = new Set<Circle>();
    const segsA = new Set<Segment>();
    const segsB = new Set<Segment>();
    for (const [endA, endB] of ends) {
        const rA = routeOfA(startA, endA);
        const rB = routeOfB(startB, endB);
        if (!isAlignable(rA) || !isAlignable(rB)) { continue; }

        endsA.add(endA);
        endsB.add(endB);
        for (const { seg } of rA) { segsA.add(seg); }
        for (const { seg } of rB) { segsB.add(seg); }
    }
    if (endsA.size === 0) { return () => undefined; }

    const unionA = [...segsA];
    const unionB = [...segsB];
    const ssgA = sampleSegTreeEndingAt(
        unionA, unitA, sampleCountFor(lenOfSegs$(unionA), δA), startA, endsA);
    const ssgB = sampleSegTreeEndingAt(
        unionB, unitB, sampleCountFor(lenOfSegs$(unionB), δB), startB, endsB);

    const { candidates } = productDtw(ssgA, ssgB, weights, swayW);

    return (endA, endB) => {
        if (!endsA.has(endA) || !endsB.has(endB)) { return undefined; }

        const c = candidates.find(c => c.endA === endA && c.endB === endB);

        return c === undefined
            ? undefined
            : { shapeCost: c.shapeCost, swayCost: c.swayCost };
    };
}


/**
 * Returns a route pair's costs from the table (`calcRoutePairsCosts`).
 */
function getRouteCosts(
        table: RouteCostsTable,
        startA: Circle,
        endA: Circle,
        startB: Circle,
        endB: Circle): { shapeCost: number; swayCost: number } | undefined {

    return table.get(startA)?.get(startB)?.get(endA)?.get(endB);
}


export { routePairCostsOf, calcRoutePairsCosts, getRouteCosts }
export type { RouteEnds }
