import type { RouteStep } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import { sampleSegTree } from '../sample-seg-tree.js';
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


export { routePairCostsOf }
