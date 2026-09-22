import type { CpNode } from "flo-mat";
import { getAllOnCircle, getRealProngCount } from 'flo-mat';


interface Fork {
    readonly cps: CpNode[];
    readonly returnPathCp: CpNode;
}


/** A partial chain still being walked, with the forks decided so far. */
interface Walk {
    readonly chain: CpNode[];
    readonly forks: Fork[];
}


/**
 * Returns all chains from `cpFrom` to `cpTo` following `next`, where
 * exactly one sector is walked at each fork and the remaining sectors are
 * skipped by jumping anti-clockwise around the fork circle.
 */
function getChainsBetween(
        cpFrom: CpNode,
        cpTo: CpNode): CpNode[][] {

    const chains: CpNode[][] = [];
    const stack: Walk[] = [{ chain: [cpFrom], forks: [] }];

    while (stack.length > 0) {
        const { chain, forks } = stack.pop()!;

        while (true) {
            const cp = chain[chain.length - 1];

            if (cp === cpTo) {
                chains.push(chain);
                break;
            }

            // Wrapped around the whole loop without reaching cpTo.
            if (cp === cpFrom && chain.length > 1) {
                break;
            }

            const fork = forks.find(f => f.cps.includes(cp));
            if (fork !== undefined) {
                // Leave a decided fork: continue out or skip to its return path.
                chain.push(cp === fork.returnPathCp
                    ? cp.next  //  continue down return path
                    : fork.returnPathCp  //  follow around n-prong to return path
                );
                continue;
            }

            if (getRealProngCount(cp) < 3) {
                chain.push(cp.next);
                continue;
            }

            // An undecided fork - branch into one walk per sector (except
            // the return path) and continue with the first of them.
            const cps = getAllOnCircle(cp);
            const returnPathCp = cp.prevOnCircle;
            /** Current forks extended with the additional for just found  */
            const extendedForks: Fork[] = [...forks, { cps, returnPathCp }];

            const branches: Walk[] = cps
                .filter(contactCp => contactCp !== returnPathCp)  // only forward branches are considered
                .map(contactCp => ({
                    chain: contactCp === cp
                        // take first exit and add to chain
                        ? [...chain, cp.next]  
                        // go around and skip 1 or more branches and add `contactCp` and its `next`
                        : [...chain, contactCp, contactCp.next],
                    forks: extendedForks  // extend the forks array
                }));

            stack.push(...branches);

            break;
        }
    }

    return chains;
}


export { getChainsBetween }
