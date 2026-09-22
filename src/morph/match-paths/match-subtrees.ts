import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { MatchedPath } from './matched-path.js';
import type { PathCostWeights } from './path-cost-weights.js';
import { memoize } from 'flo-memoize';
import { matchPathPair } from './match-path-pair.js';
import { pathsOf$ } from './paths-of.js';


/**
 * Cheapest path-pair match of the two subtrees hanging at a matched fork
 * pair (memoized on the branch pair).
 */
const matchSubtrees$ = memoize(function(
        sal1: number,
        sal2: number,
        weights: PathCostWeights) {

    return memoize(function(
            brA: FatBranch,
            brB: FatBranch): MatchedPath {

        let best: MatchedPath | undefined;

        const matchPathPair_ = matchPathPair(sal1, sal2, weights);

        for (const pA of pathsOf$(brA)) {
            for (const pB of pathsOf$(brB)) {
                const m = matchPathPair_(pA, pB, false, false);
                if (best === undefined || m.cost < best.cost) { best = m; }
            }
        }

        return best!;
    });
});


export { matchSubtrees$ }