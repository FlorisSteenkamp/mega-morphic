import type { Segment, RouteStep } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { SegMatchedPair } from './seg-matched-pair.js';
import type { FixedOps } from './fixed-ops.js';
import { buildPair } from './build-pair.js';
import { cheapChildCost } from './cheap-child-cost.js';
import { routeEndsOf } from './outline-len-of.js';
import { routeSegments } from '../route-segments.js';
import { geomOf$ } from '../geom-of.js';
import { getUnit$ } from '../get-unit.js';


/**
 * Returns the match of a coarse SAT's trees (`coarse`), refined onto a
 * finer SAT's trees `gA`, `gB` - of which the coarse trees are sub-trees
 * (every coarse vertex a fine one: see `markSplitDisks`):
 *
 * * every coarse route is carried over as the fine route between its end
 *   vertices (the same skeleton, now through more vertices)
 *
 * * every coarse child match is kept (and recurses): a coarse child is the
 *   fine child holding its entry segment's material (`fineChildOf`)
 *
 * * all other children - new at the finer scale, or dropped by the coarse
 *   match (at the coarse scale a branch may be a stub of what it is at the
 *   finer one, too short to match) - are matched in the gaps between the
 *   kept matches (`buildPair`'s `pairOfFixed`), priced as any child pair
 *   is, their sub-pairs matched freely in the fine trees
 *
 * @param coarse the coarse match
 * @param gA tree A at the finer scale
 * @param gB tree B at the finer scale
 * @param loopA glyph A's outline loop
 * @param loopB glyph B's outline loop
 * @param weights the path cost weights
 */
function refineMatch(
        coarse: SegMatchedPair,
        gA: Segment[],
        gB: Segment[],
        loopA: number[][][],
        loopB: number[][][],
        weights: PathCostWeights): SegMatchedPair {

    const unitA = getUnit$(loopA);
    const unitB = getUnit$(loopB);

    const { pairOfFixed } = buildPair(
        cheapChildCost(unitA, unitB, weights),
        gA, gB, unitA, unitB, weights, weights.childSway
    );

    const pair = refinePair(coarse, gA, gB);
    if (pair === undefined) {
        throw new Error('refineMatch: the coarse trunk is not a route of the fine trees');
    }

    return pair;


    /**
     * Returns the coarse pair refined within the fine scopes - `undefined`
     * if its routes are not routes of them.
     */
    function refinePair(
            c: SegMatchedPair,
            scopeA: Segment[],
            scopeB: Segment[]): SegMatchedPair | undefined {

        const { routeA, routeB, shapeCost, sway } = c;

        const rA = liftRoute(scopeA, routeA);
        const rB = liftRoute(scopeB, routeB);
        if (rA.length === 0 || rB.length === 0) { return undefined; }

        return pairOfFixed(
            scopeA, rA, scopeB, rB, shapeCost, sway,
            (chA, chB) => calcFixed(c, chA, chB));
    }


    /**
     * Returns the coarse pair's child matches carried over to the fine
     * children `chA`, `chB` (a coarse match without fine counterparts, or
     * whose counterparts are taken already, is left to the alignment).
     */
    function calcFixed(
            c: SegMatchedPair,
            chA: SegChild[],
            chB: SegChild[]): FixedOps {

        const matches: { a: SegChild; b: SegChild; sub: SegMatchedPair }[] = [];
        const taken = new Set<SegChild>();

        for (const op of c.ops) {
            if (op.type !== 'match') { continue; }

            const a = fineChildOf(gA, chA, op.a);
            const b = fineChildOf(gB, chB, op.b);
            if (a === undefined || b === undefined ||
                taken.has(a) || taken.has(b)) {

                continue;
            }
            const sub = refinePair(op.sub, a.segs, b.segs);
            if (sub === undefined) { continue; }

            taken.add(a);
            taken.add(b);
            matches.push({ a, b, sub });
        }

        return { matches };
    }
}


/**
 * Returns the fine route between the coarse route's end vertices (`[]` if
 * there is none within `scope`).
 */
function liftRoute(
        scope: Segment[],
        route: RouteStep[]): RouteStep[] {

    const [start, end] = routeEndsOf(route);

    return routeSegments(scope, start, end);
}


/**
 * Returns the fine child holding coarse child `c`'s material: the one
 * whose subtree contains the most fine segments of `c`'s entry segment (the
 * fine route between the entry's end vertices) - `undefined` if none
 * contains any.
 *
 * * the most, not any: children merged at a junction share its connectors
 *   (`expandBranch`), so several may hold the start of the entry
 *
 * @param g the fine tree
 * @param chF the fine children of the fine route
 * @param c the coarse child
 */
function fineChildOf(
        g: Segment[],
        chF: SegChild[],
        c: SegChild): SegChild | undefined {

    const { vertS, vertE } = geomOf$(c.entry);
    const entrySegs = new Set(routeSegments(g, vertS, vertE).map(st => st.seg));

    let best: SegChild | undefined;
    let bestN = 0;
    for (const f of chF) {
        const n = f.segs.filter(s => entrySegs.has(s)).length;
        if (n > bestN) { best = f; bestN = n; }
    }

    return best;
}


export { refineMatch }
