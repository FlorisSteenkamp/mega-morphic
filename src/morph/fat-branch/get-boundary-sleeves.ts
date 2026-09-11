import { getBoundaryBeziersToNext } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import { getSkeletonEdgeCpPairs } from "./get-fat-branch-tree.js";


/**
 * The two original boundary "sleeves" of a fat branch: the boundary pieces
 * alongside its linear skeleton path, one per side.
 *
 * `out` runs tip → other end, `back` runs other end → tip; both follow the
 * outline's positive direction, so `out` + `back` is a positively oriented
 * (open) walk around the branch. Gaps remain at skipped fork sectors (covered
 * by child branches) and at the tip caps.
 */
function getBoundarySleeves(
        fatBranch: FatBranch): { out: number[][][]; back: number[][][] } {

    const pairs = getSkeletonEdgeCpPairs(fatBranch);

    return {
        out: pairs.flatMap(pair => getBoundaryBeziersToNext(pair.out)),
        back: [...pairs].reverse()
            .flatMap(pair => getBoundaryBeziersToNext(pair.back))
    };
}


export { getBoundarySleeves }
