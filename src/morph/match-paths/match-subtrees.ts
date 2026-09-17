import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { Context } from './context.js';
import type { MatchedPath } from './matched-path.js';
import { matchPathPair } from './match-path-pair.js';
import { PathCostWeights } from './path-cost-weights.js';


/** Cheapest path-pair match of the two subtrees hanging at a matched fork
 *  pair (memoized on the branch pair). */
function matchSubtrees(
        ctx: Context,
        w: PathCostWeights,
        brA: FatBranch,
        brB: FatBranch): MatchedPath {

    const key = branchId(brA) + '|' + branchId(brB);
    const cached = ctx.memo.get(key);
    if (cached !== undefined) { return cached; }

    let best: MatchedPath | undefined;

    for (const pA of ctx.paths1(brA)) {
        for (const pB of ctx.paths2(brB)) {
            const m = matchPathPair(ctx, w, pA, pB, false, false);
            if (best === undefined || m.cost < best.cost) { best = m; }
        }
    }

    ctx.memo.set(key, best!);
    return best!;
}


function branchId(br: FatBranch): number {
    return br.cpChain[0].id;
}


export { matchSubtrees }