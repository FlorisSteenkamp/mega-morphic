import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import { calcChildPosCost, calcAngleCost, calcSizeFactor, calcDropCost } from './child-costs.js';
import { alignOutline } from './align-outline.js';

const { abs } = Math;


/** the per-match estimate returned by `cheapChildCost` */
type CalcCheapChildCost = (
    chA: SegChild[],
    chB: SegChild[],
    outlineLenA: number,
    outlineLenB: number) => number;


/**
 * Sub-DTW-free child-alignment estimate: relabel = position + angle +
 * del·|Δmaterial|; drops at full price.
 *
 * The route DP is blind to child correspondence, which can dominate the
 * recursive cost (a wrong end choice orphans whole subtrees) - this ranks
 * end choices by it BEFORE spending recursion slots.
 */
function cheapChildCost(
        unitA: number,
        unitB: number,
        weights: PathCostWeights): CalcCheapChildCost {

    const calcChildPosCost_ = calcChildPosCost(unitA, unitB, weights);
    const calcAngleCost_ = calcAngleCost(weights);
    const calcSizeFactor_ = calcSizeFactor(weights);
    const calcDropCost_ = calcDropCost(weights);

    return function(
            chA: SegChild[],
            chB: SegChild[],
            outlineLenA: number,
            outlineLenB: number): number {

        // placement scaled by the pair's size, as in the full match
        function cheapMatch(a: SegChild, b: SegChild): number {
            return calcSizeFactor_(a, b)*(
                    calcChildPosCost_(a, b, outlineLenA, outlineLenB) +
                    calcAngleCost_(a, b)
                ) +
                weights.del*abs(a.material - b.material);
        }

        return alignOutline(chA, chB, cheapMatch, calcDropCost_).cost;
    }
}


export { cheapChildCost }
export type { CalcCheapChildCost }
