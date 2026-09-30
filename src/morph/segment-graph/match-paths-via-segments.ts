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
import { procrustes } from '../procrustes/procrustes-analysis.js';

const { sqrt } = Math;


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

    const unit1 = sqrt(gA.root.roundSalience);
    const unit2 = sqrt(gB.root.roundSalience);

    // sway visibility factor (trunk pss = whole glyph loop)
    const aniso = (
        procrustes(gA.root.pss).anisotropy +
        procrustes(gB.root.pss).anisotropy
    ) / 2;

    const r = matchSegGraphs(gA, gB, unit1, unit2, weights, aniso);

    return {
        trunk: toMatchedPath(r.root, true, gA, gB, unit1, unit2, weights),
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
        gA: SegGraph,
        gB: SegGraph,
        unit1: number,
        unit2: number,
        weights: PathCostWeights): MatchedPath {

    const children: PathChildOp[] = [];
    for (const op of pair.ops) {
        if (op.type === 'match') {
            children.push({
                type: 'match',
                a: pooledOf(op.a, unit1, gA),
                b: pooledOf(op.b, unit2, gB),
                sub: toMatchedPath(
                    op.sub, false, gA, gB, unit1, unit2, weights)
            });
        } else if (op.type === 'delete') {
            // continuation leftovers are not edge-rooted: skip (implied by
            // the pieces' uncovered slices); edge-rooted drops keep an op
            if (op.a.edgeRooted) {
                children.push({
                    type: 'delete', a: pooledOf(op.a, unit1, gA) });
            }
        } else if (op.b.edgeRooted) {
            children.push({ type: 'insert', b: pooledOf(op.b, unit2, gB) });
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
            ? debugFields(pair, trunkLevel, gA, gB, unit1, unit2, weights)
            : {})
    };
}


function debugFields(
        pair: SegMatchedPair,
        trunkLevel: boolean,
        gA: SegGraph,
        gB: SegGraph,
        unit1: number,
        unit2: number,
        weights: PathCostWeights): Partial<MatchedPath> {

    const pooledDp: PooledDp[] | undefined = pair.dp?.map(d => ({
        side: d.side,
        D: d.D,
        as: d.as.map(c => pooledOf(c, unit1, gA)),
        bs: d.bs.map(c => pooledOf(c, unit2, gB)),
        ops: d.ops.map(op => op.type === 'match'
            ? { type: 'match' as const,
                a: pooledOf(op.a, unit1, gA), b: pooledOf(op.b, unit2, gB) }
            : op.type === 'delete'
            ? { type: 'delete' as const, a: pooledOf(op.a, unit1, gA) }
            : { type: 'insert' as const, b: pooledOf(op.b, unit2, gB) })
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


function pooledOf(
        c: SegChild,
        unit: number,
        g: SegGraph): PooledChild {

    return {
        // the real tree edge for edge-rooted children; continuation
        // children get a synthesized edge onto their source branch so
        // debug tools can read edge.branch (identity, pss)
        edge: (c.edgeRooted
            ? g.attachOf.get(c.entry.branch)?.edge
            : undefined) ?? {
            branch: c.entry.branch,
            distanceFromLeaf: c.dist,
            roundSalienceFromLeaf: c.material * unit*unit,
            angle: c.angle,
            side: c.side
        },
        dist: c.dist,
        side: c.side,
        angle: c.angle
    };
}


export { matchPathsViaSegments, alignOfRoutes }
