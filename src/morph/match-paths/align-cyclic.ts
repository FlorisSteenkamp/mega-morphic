import type { SeqOp } from './align-seq.js';
import { alignSeq } from './align-seq.js';


/**
 * Returns the minimum-cost monotone match, delete and insert operations of
 * two cyclic sequences.
 *
 * * runs `alignSeq` on every rotation of `as` against `bs` as given, and
 *   keeps the cheapest (the first on a tie, so the unrotated alignment wins
 *   when wrapping gains nothing)
 *
 * * that is exact: an optimal cyclic alignment can always be cut where
 *   `bs` starts, and what precedes the cut in `as` is one of its rotations
 *
 * * also returns the winning rotation of `as` (the `ops` and the DP table
 *   `D` are in its order)
 *
 * @param as the first cyclic sequence (cut anywhere)
 * @param bs the second cyclic sequence (cut anywhere)
 * @param matchCost the cost of matching `a` with `b`
 * @param delCost the cost of deleting `a`
 * @param insCost the cost of inserting `b`
 */
function alignCyclic<A, B>(
        as: A[],
        bs: B[],
        matchCost: (a: A, b: B) => number,
        delCost: (a: A) => number,
        insCost: (b: B) => number):
        { as: A[]; cost: number; ops: SeqOp<A, B>[]; D: number[][] } {

    let best = { as, ...alignSeq(as, bs, matchCost, delCost, insCost) };

    for (let k = 1; k < as.length; k++) {
        const rot = [...as.slice(k), ...as.slice(0, k)];
        const aligned = alignSeq(rot, bs, matchCost, delCost, insCost);
        if (aligned.cost < best.cost) {
            best = { as: rot, ...aligned };
        }
    }

    return best;
}


export { alignCyclic }
