declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { MatchedPath } from './matched-path.js';
import type { PathGeom } from './path-geom.js';
import { alignProfiles } from './align-profiles.js';
import { matchPooled } from './match-pooled.js';
import { sampleFeatures$ } from './sample-features.js';
import { PathCostWeights } from './path-cost-weights.js';


const { sqrt } = Math;


/**
 * Returns the result of matching one concrete path pair:
 * 
 * * profile DTW + tails + stubs + recursive pooled-children alignment.
 * 
 * @param tree1
 * @param tree2
 * @param weights Path cost weights.
 * 
 * @param pA Path geometry for tree1.
 * @param pB Path geometry for tree2.
 * @param trunkLevel `true` if the current path is at the trunk level.
 * @param coarse `true` -> uses low-resolution profiles (beam ranking only).
 */
function matchPathPair(
        sal1: number,
        sal2: number,
        weights: PathCostWeights) {

    const unit1 = sqrt(sal1);
    const unit2 = sqrt(sal2);

    const sampleFeatures_CU1 = sampleFeatures$(48, unit1);
    const sampleFeatures_FU1 = sampleFeatures$(160, unit1);
    const sampleFeatures_CU2 = sampleFeatures$(48, unit2);
    const sampleFeatures_FU2 = sampleFeatures$(160, unit2);

    return function(
            pA: PathGeom,
            pB: PathGeom,
            trunkLevel: boolean,
            coarse: boolean): MatchedPath {

        const fA = coarse
            ? sampleFeatures_CU1(pA.skelPss, pA.radii)
            : sampleFeatures_FU1(pA.skelPss, pA.radii);

        const fB = coarse
            ? sampleFeatures_CU2(pB.skelPss, pB.radii)
            : sampleFeatures_FU2(pB.skelPss, pB.radii);

        const LnA = pA.L / unit1;
        const LnB = pB.L / unit2;

        const al = alignProfiles(
            fA, fB,
            LnA / (fA.u.length - 1),
            LnB / (fB.u.length - 1),
            trunkLevel,  // the trunk's junction ends are leaf tips too
            weights
        );

        const shapeCost = al.cost - al.tailPen;
        const tailCost = al.tailPen;

        // Charge once per unmatched region, then in proportion to the material
        // bypassed on each side. The floor prevents a reroute through a
        // child-rich stretch from hiding several deletions inside one cheap
        // stub; dividing salience by its tree total makes the material term
        // dimensionless and comparable across differently scaled shapes.
        const stubCost = 
            weights.delFloor*(pA.stubN + pB.stubN) +
            weights.stub*(pA.stubSal/sal1 + pB.stubSal/sal2);

        const { ops, cost: childCost, dp } = matchPooled(
            sal1, sal2, weights, pA.pooled, pB.pooled
        );

        return {
            piecesA: pA.pieces,
            piecesB: pB.pieces,
            cost: {
                totalCost: shapeCost + tailCost + stubCost + childCost,
                shapeCost,
                childCost
            },
            tailA: al.tailStartA,
            tailB: al.tailStartB,
            children: ops,

            // Debug-only: the winning pairs stay reachable via the
            // pathMatchResult pushed by buildMorphEntries.
            ...(typeof _debug_ !== 'undefined' && !coarse ? {
                align: {
                    usA: fA.u, usB: fB.u,
                    skelPssA: pA.skelPss, skelPssB: pB.skelPss,
                    radiiA: pA.radii, radiiB: pB.radii,
                    steps: al.steps
                },
                ...(dp !== undefined ? { pooledDp: dp } : {})
            } : {})
        };
    }
}


export { matchPathPair }