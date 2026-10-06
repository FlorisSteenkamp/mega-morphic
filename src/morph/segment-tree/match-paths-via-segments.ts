declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PathAlignDebug } from '../match-paths/path-align-debug.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { PathMatchOptions } from '../match-paths/path-match-options.js';
import type { PathMatchResult } from '../match-paths/path-match-result.js';
import type { Segment } from './segment.js';
import type { RouteStep, SegMatchedPair } from './match-seg-trees.js';
import { defaultPathWeights } from '../match-paths/path-cost-weights.js';
import { sampleFeatures } from '../match-paths/sample-features.js';
import { alignProfiles } from '../match-paths/align-profiles.js';
import { matchSegTrees } from './match-seg-trees.js';
import { composeRouteGeom } from './compose-segs.js';
import { lenOf$ } from './len-of.js';
import { calcProcrustes } from '../procrustes/calc-procrustes.js';
import { getUnit$ } from './get-unit.js';


/**
 * The segment-tree matcher:
 * 
 * * routes stay segment chains and matched subtree pairs become child
 *   ops, so `buildMorphEntries` (and the match overlay) consume it unchanged.
 * 
 * * Continuation leftovers are never matched (the builder can't express
 * covered continuations) - they retract via the usual piece-stub semantics.
 */
function matchPathsViaSegments(
        gA: Segment[],
        gB: Segment[],
        loopA: number[][][],
        loopB: number[][][],
        opts: PathMatchOptions = {}): PathMatchResult {

    const weights: PathCostWeights = {
        ...defaultPathWeights,
        ...opts.weights
    };

    const unit1 = getUnit$(loopA);
    const unit2 = getUnit$(loopB);

    // sway visibility factor
    const aniso = (
        calcProcrustes(loopA).anisotropy +
        calcProcrustes(loopB).anisotropy
    ) / 2;

    const r = matchSegTrees(gA, gB, unit1, unit2, weights, aniso);

    return {
        trunk: typeof _debug_ !== 'undefined'
            ? withAlign(r.root, true, unit1, unit2, weights)
            : r.root,
        gA,
        gB,
        loopA,
        loopB,
        cost: r.root.cost
    };
}


/**
 * Debug-only: the pair tree with each pair's `align` attached (the classic
 * Gotoh re-run on the CHOSEN routes - viz-equivalent).
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


/** Classic Gotoh re-run on chosen routes (viz-equivalent alignment). */
function alignOfRoutes(
        routeA: RouteStep[],
        routeB: RouteStep[],
        unit1: number,
        unit2: number,
        weights: PathCostWeights,
        trunkLevel: boolean): PathAlignDebug {

    const { bz: bzA, rd: rdA } = composeRouteGeom(routeA);
    const { bz: bzB, rd: rdB } = composeRouteGeom(routeB);
    const fA = sampleFeatures(bzA, rdA, unit1);
    const fB = sampleFeatures(bzB, rdB, unit2);
    const steps = alignProfiles(
        fA, fB,
        (lenOf$(bzA)/unit1) / (fA.u.length - 1),
        (lenOf$(bzB)/unit2) / (fB.u.length - 1),
        trunkLevel,
        weights);

    return {
        usA: fA.u, usB: fB.u,
        skelPssA: bzA, skelPssB: bzB,
        radiiA: rdA, radiiB: rdB,
        steps
    };
}



export { matchPathsViaSegments, alignOfRoutes }
