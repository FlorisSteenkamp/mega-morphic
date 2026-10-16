import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import { alignSeq } from '../../match-paths/align-seq.js';
import { posCostOf, angleCostOf, dropCostOf, terminalGated, seqOf } from './child-costs.js';

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

    const posCost = posCostOf(unitA, unitB, weights);
    const angleCost = angleCostOf(weights);
    const drop = dropCostOf(weights);

    return function(
            chA: SegChild[],
            chB: SegChild[],
            lenRA: number,
            lenRB: number): number {

        function cheapMatch(a: SegChild, b: SegChild): number {
            return terminalGated(a, b)
                ? Infinity
                : posCost(a, b, lenRA, lenRB) +
                  angleCost(a, b) +
                  weights.del*abs(a.material - b.material);
        }

        let cost = 0;
        for (const side of [1, -1] as const) {
            cost += alignSeq(
                seqOf(chA, side),
                seqOf(chB, side),
                cheapMatch,  // match
                drop,        // del
                drop         // ins
            ).cost;
        }

        return cost;
    }
}


export { cheapChildCost }
export type { CalcCheapChildCost }
