import type { SegMatchedPair } from './seg-matched-pair.js';
import { CAND_MARGIN } from './consts.js';
import { scoreOf } from './score-of.js';


/**
 * The best of the ranked route-pair leaders by full (recursive) evaluation.
 *
 * * leaders are evaluated in rank order, stopping at the first one ranked
 *   more than `CAND_MARGIN` above the best, or after `maxEvals` evaluations
 * * selection value = the built pair's `scoreOf` (recursive cost + the
 *   routes' measured sway); the first leader of minimum selection value
 *   wins
 *
 * @param leaders the leaders, sorted by rank (best first, at least one)
 * @param maxEvals the maximum number of full evaluations
 * @param build fully builds a leader's pair (the costly recursion)
 */
function pickBest<L extends { rank: number }>(
        leaders: L[],
        maxEvals: number,
        build: (l: L) => SegMatchedPair): SegMatchedPair {

    const limit = leaders[0].rank + CAND_MARGIN;

    let best: SegMatchedPair | undefined;
    let bestSel = Infinity;
    let evals = 0;
    for (const l of leaders) {
        if (l.rank > limit || evals >= maxEvals) { break; }
        evals++;

        const pair = build(l);
        const sel = scoreOf(pair);
        if (sel < bestSel) {
            bestSel = sel;
            best = pair;
        }
    }

    return best!;
}


export { pickBest }
