declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { FatBranch, FatBranchEdge } from '../fat-branch/fat-branch.js';
import type { MatchedPath, PooledDp } from '../match-paths/matched-path.js';
import type { PathChildOp } from '../match-paths/path-child-op.js';
import type { PooledChild } from '../match-paths/pooled-child.js';
import type { PathPiece } from '../match-paths/path-piece.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { PathMatchOptions } from '../match-paths/path-match-options.js';
import type { PathMatchResult } from '../match-paths/path-match-result.js';
import type { RouteStep, SegMatchedPair, SegChild } from './match-seg-graphs.js';
import { defaultPathWeights } from '../match-paths/match-paths.js';
import { sampleFeatures$ } from '../match-paths/sample-features.js';
import { alignProfiles } from '../match-paths/align-profiles.js';
import { segGraphOf } from './segment-graph.js';
import { matchSegGraphs } from './match-seg-graphs.js';

const { sqrt } = Math;


/**
 * The segment-graph matcher behind the classic `matchPaths` interface:
 * routes become `PathPiece` chains and matched subtree pairs become child
 * ops, so `buildMorphEntries` (and the match overlay) consume it unchanged.
 * Continuation leftovers are never matched (the builder can't express
 * covered continuations) - they retract via the usual piece-stub semantics.
 */
function matchPathsViaSegments(
        tree1: FatBranch,
        tree2: FatBranch,
        opts: PathMatchOptions = {}): PathMatchResult {

    const weights: PathCostWeights = {
        ...defaultPathWeights,
        ...opts.weights
    };

    const unit1 = sqrt(tree1.roundSalience);
    const unit2 = sqrt(tree2.roundSalience);

    const r = matchSegGraphs(
        segGraphOf(tree1), segGraphOf(tree2), unit1, unit2, weights);

    return {
        trunk: toMatchedPath(r.root, true, unit1, unit2, weights),
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
                a: pooledOf(op.a, unit1),
                b: pooledOf(op.b, unit2),
                sub: toMatchedPath(op.sub, false, unit1, unit2, weights)
            });
        } else if (op.type === 'delete') {
            // continuation leftovers have no edge: skip (implied by the
            // pieces' uncovered slices); edge-rooted drops keep an op
            if (op.a.edge !== undefined) {
                children.push({ type: 'delete', a: pooledOf(op.a, unit1) });
            }
        } else if (op.b.edge !== undefined) {
            children.push({ type: 'insert', b: pooledOf(op.b, unit2) });
        }
    }

    const childCost = pair.cost - pair.shapeCost;

    return {
        piecesA: toPieces(pair.routeA),
        piecesB: toPieces(pair.routeB),
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

    const gA = composeRoute(pair.routeA);
    const gB = composeRoute(pair.routeB);
    const fA = sampleFeatures$(160, unit1)(gA.skelPss, gA.radii);
    const fB = sampleFeatures$(160, unit2)(gB.skelPss, gB.radii);
    const al = alignProfiles(
        fA, fB,
        (gA.L/unit1) / (fA.u.length - 1),
        (gB.L/unit2) / (fB.u.length - 1),
        trunkLevel,
        weights);

    const pooledDp: PooledDp[] | undefined = pair.dp?.map(d => ({
        side: d.side,
        D: d.D,
        as: d.as.map(c => pooledOf(c, unit1)),
        bs: d.bs.map(c => pooledOf(c, unit2)),
        ops: d.ops.map(op => op.type === 'match'
            ? { type: 'match' as const,
                a: pooledOf(op.a, unit1), b: pooledOf(op.b, unit2) }
            : op.type === 'delete'
            ? { type: 'delete' as const, a: pooledOf(op.a, unit1) }
            : { type: 'insert' as const, b: pooledOf(op.b, unit2) })
    }));

    return {
        align: {
            usA: fA.u, usB: fB.u,
            skelPssA: gA.skelPss, skelPssB: gB.skelPss,
            radiiA: gA.radii, radiiB: gB.radii,
            steps: al.steps
        },
        ...(pooledDp !== undefined ? { pooledDp } : {})
    };
}


/** Route steps → composed skeleton geometry (as composePieces). */
function composeRoute(route: RouteStep[]): {
        skelPss: number[][][]; radii: number[]; L: number } {

    const skelPss: number[][][] = [];
    const radii: number[] = [];
    let L = 0;
    for (const { seg, reversed } of route) {
        const pss = reversed
            ? seg.pss.map(ps => ps.toReversed()).reverse()
            : seg.pss;
        const rd = reversed ? seg.radii.toReversed() : seg.radii;
        skelPss.push(...pss);
        radii.push(...(radii.length > 0 ? rd.slice(1) : rd));
        L += seg.len;
    }
    return { skelPss, radii, L };
}


function pooledOf(c: SegChild, unit: number): PooledChild {
    return {
        // continuation children get a synthesized edge onto their source
        // branch so debug tools can read edge.branch (identity, pss)
        edge: c.edge ?? {
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


/** Route steps → piece chain (adjacent same-branch slices merged). */
function toPieces(route: RouteStep[]): PathPiece[] {
    const out: PathPiece[] = [];

    for (const { seg, reversed } of route) {
        const last = out[out.length - 1];
        if (last !== undefined &&
            last.branch === seg.branch &&
            last.reversed === reversed &&
            (reversed
                ? last.fromEdge === seg.toEdge
                : last.toEdge === seg.fromEdge)) {

            out[out.length - 1] = {
                branch: last.branch,
                fromEdge: reversed ? seg.fromEdge : last.fromEdge,
                toEdge: reversed ? last.toEdge : seg.toEdge,
                reversed
            };
            continue;
        }
        out.push({
            branch: seg.branch,
            fromEdge: seg.fromEdge,
            toEdge: seg.toEdge,
            reversed
        });
    }

    return out;
}


export { matchPathsViaSegments }
