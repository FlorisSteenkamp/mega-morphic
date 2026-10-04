declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { MatchedPath, PooledDp, PathAlignDebug } from '../match-paths/matched-path.js';
import type { PathChildOp } from '../match-paths/path-child-op.js';
import type { PooledChild } from '../match-paths/pooled-child.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { PathMatchOptions } from '../match-paths/path-match-options.js';
import type { PathMatchResult } from '../match-paths/path-match-result.js';
import type { SegGraph } from './seg-graph.js';
import type { RouteStep, SegMatchedPair, SegChild } from './match-seg-graphs.js';
import { defaultPathWeights } from '../match-paths/path-cost-weights.js';
import { sampleFeatures$ } from '../match-paths/sample-features.js';
import { alignProfiles } from '../match-paths/align-profiles.js';
import { matchSegGraphs, composeRoute } from './match-seg-graphs.js';
import { calcProcrustes } from '../procrustes/calc-procrustes.js';
import { getUnit$ } from './get-unit.js';


/**
 * The segment-graph matcher:
 * 
 * * routes stay segment chains and matched subtree pairs become child
 *   ops, so `buildMorphEntries` (and the match overlay) consume it unchanged.
 * 
 * * Continuation leftovers are never matched (the builder can't express
 * covered continuations) - they retract via the usual piece-stub semantics.
 */
function matchPathsViaSegments(
        gA: SegGraph,
        gB: SegGraph,
        opts: PathMatchOptions = {}): PathMatchResult {

    const weights: PathCostWeights = {
        ...defaultPathWeights,
        ...opts.weights
    };

    const unit1 = getUnit$(gA.loop);
    const unit2 = getUnit$(gB.loop);

    // sway visibility factor
    const aniso = (
        calcProcrustes(gA.loop).anisotropy +
        calcProcrustes(gB.loop).anisotropy
    ) / 2;

    const r = matchSegGraphs(gA, gB, unit1, unit2, weights, aniso);

    return {
        trunk: toMatchedPath(r.root, true, unit1, unit2, weights),
        gA,
        gB,
        // routes carry their own directions per piece - no global flip
        flipped: false,
        cost: r.cost
    };
}


function toMatchedPath(
        pair: SegMatchedPair,
        trunkLevel: boolean,
        unit1: number,
        unit2: number,
        weights: PathCostWeights): MatchedPath {

    const children: PathChildOp[] = [];
    for (const op of pair.ops) {
        if (op.type === 'match') {
            children.push({
                type: 'match',
                a: pooledOf(op.a),
                b: pooledOf(op.b),
                sub: toMatchedPath(
                    op.sub, false, unit1, unit2, weights)
            });
        } else if (op.type === 'delete') {
            children.push({ type: 'delete', a: pooledOf(op.a) });
        } else {
            children.push({ type: 'insert', b: pooledOf(op.b) });
        }
    }

    const childCost = pair.cost - pair.shapeCost;

    return {
        routeA: pair.routeA,
        routeB: pair.routeB,
        cost: {
            totalCost: pair.cost,
            shapeCost: pair.shapeCost,
            childCost
        },
        tailA: 0,
        tailB: 0,
        children,
        // Debug-only: same viz data the classic matcher attaches - align is
        // the classic Gotoh re-run on the CHOSEN routes (viz-equivalent).
        ...(typeof _debug_ !== 'undefined'
            ? debugFields(pair, trunkLevel, unit1, unit2, weights)
            : {})
    };
}


function debugFields(
        pair: SegMatchedPair,
        trunkLevel: boolean,
        unit1: number,
        unit2: number,
        weights: PathCostWeights): Partial<MatchedPath> {

    const pooledDp: PooledDp[] | undefined = pair.dp?.map(d => ({
        side: d.side,
        D: d.D,
        as: d.as.map(pooledOf),
        bs: d.bs.map(pooledOf),
        ops: d.ops.map(op => op.type === 'match'
            ? { type: 'match' as const,
                a: pooledOf(op.a), b: pooledOf(op.b) }
            : op.type === 'delete'
            ? { type: 'delete' as const, a: pooledOf(op.a) }
            : { type: 'insert' as const, b: pooledOf(op.b) })
    }));

    return {
        align: alignOfRoutes(
            pair.routeA, pair.routeB, unit1, unit2, weights, trunkLevel),
        ...(pooledDp !== undefined ? { pooledDp } : {})
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

    const gA = composeRoute(routeA);
    const gB = composeRoute(routeB);
    const fA = sampleFeatures$(160, unit1)(gA.skelPss, gA.radii);
    const fB = sampleFeatures$(160, unit2)(gB.skelPss, gB.radii);
    const al = alignProfiles(
        fA, fB,
        (gA.L/unit1) / (fA.u.length - 1),
        (gB.L/unit2) / (fB.u.length - 1),
        trunkLevel,
        weights);

    return {
        usA: fA.u, usB: fB.u,
        skelPssA: gA.skelPss, skelPssB: gB.skelPss,
        radiiA: gA.radii, radiiB: gB.radii,
        steps: al.steps
    };
}


function pooledOf(c: SegChild): PooledChild {
    return {
        entry: c.entry,
        segs: c.segs,
        dist: c.dist,
        side: c.side,
        angle: c.angle,
        material: c.material
    };
}


export { matchPathsViaSegments, alignOfRoutes }
