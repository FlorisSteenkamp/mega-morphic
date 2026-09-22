declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { MatchedPath } from './matched-path.js';
import type { PathGeom } from './path-geom.js';
import { alignProfiles } from './align-profiles.js';
import { matchPooled } from './match-pooled.js';
import { sampleFeatures } from './sample-features.js';
import { PathCostWeights } from './path-cost-weights.js';
import { FatBranch } from '../fat-branch/fat-branch.js';


const { sqrt } = Math;


/**
 * Returns the result of matching one concrete path pair:
 * 
 * * profile DTW + tails + stubs + recursive pooled-children alignment.
 * 
 * @param tree1
 * @param tree2
 * @param w Path cost weights.
 * 
 * @param pA Path geometry for tree1.
 * @param pB Path geometry for tree2.
 * @param trunkLevel `true` if the current path is at the trunk level.
 * @param coarse `true` -> uses low-resolution profiles (beam ranking only).
 */
function matchPathPair(
        sal1: number,
        sal2: number,
        w: PathCostWeights) {

    const unit1 = sqrt(sal1);
    const unit2 = sqrt(sal2);

    return function(
            pA: PathGeom,
            pB: PathGeom,
            trunkLevel: boolean,
            coarse: boolean): MatchedPath {

        const fA = coarse
            ? pA.coarse ??= sampleFeatures(pA.skelPss, pA.radii, unit1, 48)
            : pA.samples ??= sampleFeatures(pA.skelPss, pA.radii, unit1, 160);

        const fB = coarse
            ? pB.coarse ??= sampleFeatures(pB.skelPss, pB.radii, unit2, 48)
            : pB.samples ??= sampleFeatures(pB.skelPss, pB.radii, unit2, 160);

        const LnA = pA.L / unit1;
        const LnB = pB.L / unit2;

        const al = alignProfiles(
            fA, fB,
            LnA / (fA.u.length - 1),
            LnB / (fB.u.length - 1),
            trunkLevel,  // the trunk's junction ends are leaf tips too
            w
        );

        const shapeCost = al.cost - al.tailPen;
        const tailCost = al.tailPen;

        // Charge once per unmatched region, then in proportion to the material
        // bypassed on each side. The floor prevents a reroute through a
        // child-rich stretch from hiding several deletions inside one cheap
        // stub; dividing salience by its tree total makes the material term
        // dimensionless and comparable across differently scaled shapes.
        const stubCost = 
            w.delFloor*(pA.stubN + pB.stubN) +
            w.stub*(pA.stubSal/sal1 + pB.stubSal/sal2);

        const { ops, cost: childCost } = matchPooled(
            sal1, sal2, w, pA.pooled, pB.pooled
        );

        return {
            piecesA: pA.pieces,
            piecesB: pB.pieces,
            cost: shapeCost + tailCost + stubCost + childCost,
            shapeCost,
            childCost,
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
                }
            } : {})
        };
    }
}


export { matchPathPair }