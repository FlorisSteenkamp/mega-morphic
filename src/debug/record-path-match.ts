declare var _debug_: Debug;
import type { Debug } from './debug.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { Segment } from '../morph/segment-tree/segment.js';
import { getUnit$ } from '../morph/segment-tree/get-unit.js';
import { alignOfRoutes } from './align-of-routes.js';
import { recordChildDtwPair } from './record-child-dtw-pair.js';
import { calcSubWeights } from '../morph/segment-tree/match-seg-trees/calc-sub-weights.js';
import { anisoOf } from '../morph/segment-tree/match-seg-trees/aniso-of.js';
import { lenOfSegs$ } from '../morph/segment-tree/len-of.js';
import { TARGET_SAMPLES } from '../morph/segment-tree/match-seg-trees/consts.js';


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

    const ctx: AlignContext = {
        unitA: getUnit$(loopA),
        unitB: getUnit$(loopB),
        // the matcher's trunk-level sample spacing and sway factors
        δA: lenOfSegs$(gA)/TARGET_SAMPLES,
        δB: lenOfSegs$(gB)/TARGET_SAMPLES,
        sway: weights.sway*anisoOf(loopA, loopB),
        childSway: weights.childSway,
        weights
    };

    // Keep only the LATEST result - readers use [0]/at(-1) and stale
    // entries (whole trees) would otherwise accumulate.
    _debug_.elems.pathMatchResult.length = 0;
    _debug_.elems.pathMatchResult.push({
        trunk: withAlign(trunk, ctx, weights, 0, false),
        gA, gB, loopA, loopB
    });

    // a pair picked in the previous match is stale now
    recordChildDtwPair(undefined);
}


/** What every pair's alignment is computed with (see `alignOfRoutes`). */
interface AlignContext {
    readonly unitA: number;
    readonly unitB: number;
    readonly δA: number;
    readonly δB: number;
    /** the trunk's sway factor */
    readonly sway: number;
    /** child pairs' sway factor */
    readonly childSway: number;
    /** the match's weights */
    readonly weights: PathCostWeights;
}


/**
 * The pair tree with each pair's `align` attached: the matcher's own
 * alignment of its routes (`alignOfRoutes`).
 *
 * @param pair the pair
 * @param ctx the match's context
 * @param pairWeights the weights the pair's own routes were aligned with
 * (a child pair's: `calcSubWeights`)
 * @param rotB the rotation of B's directions into A's frame (a child
 * pair's parent-frame difference, `0` for the trunk)
 * @param isChild `true` for a child pair
 */
function withAlign(
        pair: SegMatchedPair,
        ctx: AlignContext,
        pairWeights: PathCostWeights,
        rotB: number,
        isChild: boolean): SegMatchedPair {

    const { routeA, routeB, ops } = pair;
    const { unitA, unitB, δA, δB, sway, childSway, weights } = ctx;

    const align = alignOfRoutes(
        routeA, routeB, unitA, unitB, δA, δB,
        pairWeights, isChild ? childSway : sway, rotB, isChild);

    return {
        ...pair,
        ops: ops.map(op => op.type === 'match'
            ? {
                ...op,
                sub: withAlign(
                    op.sub, ctx, calcSubWeights(weights, op.a, op.b),
                    op.a.routeDir - op.b.routeDir, true)
            }
            : op
        ),
        ...(align !== undefined ? { align } : {})
    };
}


export { recordPathMatch }
