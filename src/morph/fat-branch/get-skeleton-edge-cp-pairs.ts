import type { CpNode } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import { rotateAtTip } from "./rotate-at-tip.js";
import { closeChain } from "./close-chain.js";
import { getCircleId } from './get-circle-id.js';
import { getEdgeKey } from "./get-edge-key.js";


/**
 * Per skeleton edge of the fat branch's linear path (tip → other end): the
 * chain CpNode walking it on the outbound boundary side (`out`, in skeleton
 * direction) and the one walking it back on the other side (`back`, in
 * REVERSE skeleton direction).
 */
function getSkeletonEdgeCpPairs(
        fatBranch: FatBranch): { out: CpNode; back: CpNode }[] {

    const cpChain = rotateAtTip(closeChain(fatBranch.cpChain));
    const pairs: { out: CpNode; back: CpNode }[] = [];
    const edgeIdx = new Map<string, number>();

    for (let i = 0; i < cpChain.length - 1; i++) {
        const cp = cpChain[i];

        if (cpChain[i+1] === cp.next) {
            // Skip self-edges: steps between two contacts on the SAME circle
            // (leaf-tip caps) — boundary walks them once, and they are not
            // skeleton edges (zero-length mat curves).
            if (getCircleId(cp) === getCircleId(cp.next)) { continue; }

            const key = getEdgeKey(cp, cp.next);
            const idx = edgeIdx.get(key);
            if (idx === undefined) {
                edgeIdx.set(key, pairs.length);
                pairs.push({ out: cp, back: undefined! });
            } else {
                pairs[idx].back = cp;
            }
        }
    }

    return pairs;
}


export { getSkeletonEdgeCpPairs }
