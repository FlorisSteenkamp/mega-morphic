import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { Context } from './context.js';
import type { MatchedPath } from './matched-path.js';
import { memoize } from 'flo-memoize';
import { matchPathPair } from './match-path-pair.js';
import { PathCostWeights } from './path-cost-weights.js';


/**
 * Cheapest path-pair match of the two subtrees hanging at a matched fork
 * pair (memoized on the branch pair).
 */
const matchSubtrees = memoize(function(
        ctx: Context,
        weights: PathCostWeights,
        brA: FatBranch,
        brB: FatBranch): MatchedPath {

    let best: MatchedPath | undefined;

    for (const pA of ctx.paths1(brA)) {
        for (const pB of ctx.paths2(brB)) {
            const m = matchPathPair(ctx, weights, pA, pB, false, false);
            if (best === undefined || m.cost < best.cost) { best = m; }
        }
    }

    return best!;
});


export { matchSubtrees }