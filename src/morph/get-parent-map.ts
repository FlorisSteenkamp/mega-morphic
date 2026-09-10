import type { FatBranch } from "./fat-branch";


/**
 * Returns a map from each FatBranch to its parent.
 * 
 * @param root 
 */
function getParentMap(
        root: FatBranch): Map<FatBranch, FatBranch> {

    const map = new Map<FatBranch, FatBranch>();

    walk(root);

    return map;

    function walk(parent: FatBranch) {
        for (const edge of parent.children ?? []) {
            map.set(edge.branch, parent);
            walk(edge.branch);
        }
    };
}


export { getParentMap }
