declare var _debug_: Debug;
import type { Debug } from './debug.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { Segment } from '../morph/segment-tree/segment.js';
import { getUnit$ } from '../morph/segment-tree/get-unit.js';
import { alignOfRoutes } from './align-of-routes.js';


/**
 * * **Debug only**
 *
 * Stores the latest path match (with each pair's `align` attached) for
 * the match overlay and logs. A no-op unless morph debugging is enabled.
 */
function recordPathMatch(
        trunk: SegMatchedPair,
        gA: Segment[],
        gB: Segment[],
        loopA: number[][][],
        loopB: number[][][],
        weights: PathCostWeights) {

    // The morph arrays only exist when morph debugging is enabled (other
    // debug configs, e.g. flo-boolean-only in tests, lack them).
    if (typeof _debug_ === 'undefined' ||
        _debug_.elems?.pathMatchResult === undefined) {
        return;
    }

    const unit1 = getUnit$(loopA);
    const unit2 = getUnit$(loopB);

    // Keep only the LATEST result - readers use [0]/at(-1) and stale
    // entries (whole trees) would otherwise accumulate.
    _debug_.elems.pathMatchResult.length = 0;
    _debug_.elems.pathMatchResult.push({
        trunk: withAlign(trunk, true, unit1, unit2, weights),
        gA, gB, loopA, loopB
    });
}


/**
 * The pair tree with each pair's `align` attached (the classic Gotoh
 * re-run on the CHOSEN routes - viz-equivalent).
 */
function withAlign(
        pair: SegMatchedPair,
        trunkLevel: boolean,
        unit1: number,
        unit2: number,
        weights: PathCostWeights): SegMatchedPair {

    const { routeA, routeB, ops } = pair;

    return {
        ...pair,
        ops: ops.map(op => op.type === 'match'
            ? { ...op, sub: withAlign(op.sub, false, unit1, unit2, weights) }
            : op
        ),
        align: alignOfRoutes(routeA, routeB, unit1, unit2, weights, trunkLevel)
    };
}


export { recordPathMatch }
