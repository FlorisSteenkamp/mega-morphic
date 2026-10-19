import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import { calcChildPosCost, calcAngleCost, calcDropCost, isTerminalGated } from './child-costs.js';
import { alignSides } from './align-sides.js';
import { sum } from '../../../utils/sum.js';

const { abs } = Math;


/** the per-match estimate returned by `cheapChildCost` */
type CalcCheapChildCost = (
    chA: SegChild[],
    chB: SegChild[],
    lenRA: number,
    lenRB: number) => number;


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
    const calcDropCost_ = calcDropCost(weights);

    return function(
            chA: SegChild[],
            chB: SegChild[],
            lenRA: number,
            lenRB: number): number {

        function cheapMatch(a: SegChild, b: SegChild): number {
            return isTerminalGated(a, b)
                ? Infinity
                : calcChildPosCost_(a, b, lenRA, lenRB) +
                  calcAngleCost_(a, b) +
                  weights.del*abs(a.material - b.material);
        }

        return sum(alignSides(chA, chB, cheapMatch, calcDropCost_).map(s => s.cost));
    }
}


export { cheapChildCost }
export type { CalcCheapChildCost }
