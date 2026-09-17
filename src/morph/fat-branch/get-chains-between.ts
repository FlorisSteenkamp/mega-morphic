import type { CpNode } from "flo-mat";
import { getAllOnCircle, getRealProngCount } from 'flo-mat';


interface Fork {
    readonly contacts: CpNode[];
    readonly exit: CpNode;
}


/**
 * Returns all boundary chains from `cpFrom` to `cpTo` following `next`, where
 * exactly one sector is walked at each fork and the remaining sectors are
 * skipped by jumping anti-clockwise around the fork circle.
 */
function getChainsBetween(
        cpFrom: CpNode,
        cpTo: CpNode): CpNode[][] {

    const chains: CpNode[][] = [];

    walk([cpFrom], []);

    return chains;

    function walk(chain: CpNode[], forks: Fork[]) {
        while (true) {
            const cp = chain[chain.length - 1];

            if (cp === cpTo) {
                chains.push(chain);
                return;
            }

            // Wrapped around the whole loop without reaching cpTo.
            if (cp === cpFrom && chain.length > 1) {
                return;
            }

            const fork = forks.find(f => f.contacts.includes(cp));
            if (fork !== undefined) {
                // Leave a decided fork: continue out or skip to its exit.
                chain.push(cp === fork.exit ? cp.next : fork.exit);
                continue;
            }

            if (getRealProngCount(cp) >= 3) {
                const contacts = getAllOnCircle(cp);
                const exit = cp.prevOnCircle;
                const nextForks = [...forks, { contacts, exit }];

                for (const contact of contacts) {
                    if (contact === exit) { continue; }
                    walk(
                        contact === cp
                            ? [...chain, cp.next]
                            : [...chain, contact, contact.next],
                        nextForks
                    );
                }
                return;
            }

            chain.push(cp.next);
        }
    }
}


export { getChainsBetween }
