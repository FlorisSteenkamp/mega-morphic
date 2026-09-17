import type { Context } from './context.js';
import type { MatchedPath } from './matched-path.js';
import type { PathGeom } from './path-geom.js';
import { alignProfiles } from './align-profiles.js';
import { matchPooled } from './match-pooled.js';
import { sampleFeatures } from './sample-features.js';
import { PathCostWeights } from './path-cost-weights.js';


/**
 * Match one concrete path pair: profile DTW + tails + stubs + recursive
 * pooled-children alignment. `coarse` uses low-resolution profiles (beam
 * ranking only).
 */
function matchPathPair(
        ctx: Context,
        w: PathCostWeights,
        pA: PathGeom,
        pB: PathGeom,
        trunkLevel: boolean,
        coarse: boolean): MatchedPath {

    // const { w } = ctx;

    const fA = coarse
        ? pA.coarse ??= sampleFeatures(pA.bz, pA.rd, ctx.unit1, 48)
        : pA.samples ??= sampleFeatures(pA.bz, pA.rd, ctx.unit1);
    const fB = coarse
        ? pB.coarse ??= sampleFeatures(pB.bz, pB.rd, ctx.unit2, 48)
        : pB.samples ??= sampleFeatures(pB.bz, pB.rd, ctx.unit2);

    const LnA = pA.L / ctx.unit1;
    const LnB = pB.L / ctx.unit2;

    const al = alignProfiles(
        fA, fB,
        LnA / (fA.u.length - 1),
        LnB / (fB.u.length - 1),
        trunkLevel,  // the trunk's junction ends are leaf tips too
        w);

    const shapeCost = al.cost - al.tailPen;
    const tailCost = al.tailPen;
    const stubCost = w.delFloor * (pA.stubN + pB.stubN) +
        w.stub * (pA.stubSal / ctx.sal1 + pB.stubSal / ctx.sal2);

    const { ops, cost: childCost } = matchPooled(
        ctx, w, pA.pooled, pB.pooled);

    return {
        piecesA: pA.pieces,
        piecesB: pB.pieces,
        cost: shapeCost + tailCost + stubCost + childCost,
        shapeCost,
        tailA: al.tailStartA,
        tailB: al.tailStartB,
        children: ops
    };
}


export { matchPathPair }