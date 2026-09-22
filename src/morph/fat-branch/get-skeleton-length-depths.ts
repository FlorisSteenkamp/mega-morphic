import type { CpNode } from "flo-mat";
import { getMatCurveToNext } from "flo-mat";
import { totalLength$ } from "../fs/total-length.js";
import { getEdgeKey } from "./get-edge-key.js";


/**
 * Returns per-node skeleton arc distances from the chain start. Every
 * skeleton edge occurs exactly twice (once per boundary side): the first
 * occurrence walks away from the start, the second walks back.
 */
function getSkeletonLengthDepths(
        cpChain: CpNode[]): number[] {

    const cumLengths: number[] = [0];
    const seen = new Set<string>();
    let d = 0;

    for (let i=0; i<cpChain.length - 1; i++) {
        const cp = cpChain[i];

        if (cpChain[i+1] === cp.next) {
            const key = getEdgeKey(cp, cp.next);
            const len = totalLength$(getMatCurveToNext(cp));
            if (seen.has(key)) {
                d -= len;
            } else {
                seen.add(key);
                d += len;
            }
        }

        cumLengths.push(d);
    }

    return cumLengths;
}


export { getSkeletonLengthDepths }
