import type { Context } from './context.js';
import type { MatchedPath } from './matched-path.js';
import type { PathGeom } from './path-geom.js';
import { alignProfiles } from './align-profiles.js';
import { matchPooled } from './match-pooled.js';
import { sampleFeatures } from './sample-features.js';
import { PathCostWeights } from './path-cost-weights.js';


const { sqrt } = Math;


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

    const fA = coarse
        ? pA.coarse ??= sampleFeatures(pA.bz, pA.rd, sqrt(ctx.sal1), 48)
        : pA.samples ??= sampleFeatures(pA.bz, pA.rd, sqrt(ctx.sal1), 160);

    const fB = coarse
        ? pB.coarse ??= sampleFeatures(pB.bz, pB.rd, sqrt(ctx.sal2), 48)
        : pB.samples ??= sampleFeatures(pB.bz, pB.rd, sqrt(ctx.sal2), 160);

    const LnA = pA.L / sqrt(ctx.sal1);
    const LnB = pB.L / sqrt(ctx.sal2);

    const al = alignProfiles(
        fA, fB,
        LnA / (fA.u.length - 1),
        LnB / (fB.u.length - 1),
        trunkLevel,  // the trunk's junction ends are leaf tips too
        w);

    const shapeCost = al.cost - al.tailPen;
    const tailCost = al.tailPen;

    // Charge once per unmatched region, then in proportion to the material
    // bypassed on each side. The floor prevents a reroute through a
    // child-rich stretch from hiding several deletions inside one cheap
    // stub; dividing salience by its tree total makes the material term
    // dimensionless and comparable across differently scaled shapes.
    const stubCost = 
        w.delFloor*(pA.stubN + pB.stubN) +
        w.stub*(pA.stubSal / ctx.sal1 + pB.stubSal / ctx.sal2);

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