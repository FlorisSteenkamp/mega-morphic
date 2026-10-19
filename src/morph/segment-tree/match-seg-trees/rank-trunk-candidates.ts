import type { Circle } from 'flo-mat';
import type { Ranked } from './ranked.js';
import type { ProductDtwResult_Candidate } from '../product-dtw.js';
import type { DualMap } from '../../../utils/dual-map.js';
import type { DualSet } from '../../../utils/dual-set.js';
import { DualMapFs } from '../../../utils/dual-map.js';
import { DualSetFs } from '../../../utils/dual-set.js';


/**
 * The trunk candidates, deduped and ranked by DP cost + sway (best first).
 *
 * * both-routes-reversed is the SAME end correspondence - only the first of
 *   the two is kept (costs differ only via the posCost start/end asymmetry;
 *   the slot is worth more than that tie-break. Sway is invariant under
 *   double reversal: both φ's shift by π.)
 * @param candidates
 */
function rankTrunkCandidates(
        candidates: ProductDtwResult_Candidate[]): Ranked[] {

    /** route pairs seen so far: (startA, endA) → (startB, endB)s */
    const seen: DualMap<Circle, Circle, DualSet<Circle, Circle>> = new Map();
    const isSeen_ = isSeen(seen);
    const markSeen_ = markSeen(seen);

    const ranked: Ranked[] = [];
    for (const c of candidates) {
        const { startA, endA, startB, endB } = c;
        if (isSeen_(startA, endA, startB, endB) ||
            isSeen_(endA, startA, endB, startB)) { continue; }
        markSeen_(startA, endA, startB, endB);
        ranked.push({
            c,
            rank: c.totalCost + c.swayCost,
            cheap: 0
        });
    }
    ranked.sort((x, y) => x.rank - y.rank);

    return ranked;
}


/**
 * Returns a function telling whether the route pair (`a0` → `a1` in A,
 * `b0` → `b1` in B) is in `seen`.
 * @param seen
 */
function isSeen(
        seen: DualMap<Circle, Circle, DualSet<Circle, Circle>>) {

    return function(
            a0: Circle, a1: Circle,
            b0: Circle, b1: Circle): boolean {

        const bs = DualMapFs.get(seen, a0, a1);
        return bs !== undefined && DualSetFs.has(bs, b0, b1);
    }
}


/**
 * Returns a function adding the route pair (`a0` → `a1` in A, `b0` → `b1`
 * in B) to `seen`.
 * @param seen
 */
function markSeen(
        seen: DualMap<Circle, Circle, DualSet<Circle, Circle>>) {

    return function(
            a0: Circle, a1: Circle,
            b0: Circle, b1: Circle): void {

        const bs = DualMapFs.getOrInsertComputed(seen, a0, a1, () => new Map());
        DualSetFs.add(bs, b0, b1);
    }
}


export { rankTrunkCandidates }
