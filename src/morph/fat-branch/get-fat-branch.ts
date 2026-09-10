import type { CpNode } from "flo-mat";
import { FatBranch } from './fat-branch.js';
import { getAllOnCircle, getRealProngCount } from "flo-mat";
import { getShapeArea } from "flo-boolean";
import { getFatSaliencePss } from "./get-fat-salience.js";


function getFatBranch(
        cpNode: CpNode): FatBranch | undefined {

    if (getRealProngCount(cpNode) !== 2) {
        return undefined;
    }

    const cpStart = cpNode;
    const cpOpp = cpNode.prevOnCircle;

    // The boundary from cpStart to cpOpp covers one side of the branch (out
    // along one side and back along the other); continuing from cpOpp back to
    // cpStart covers the opposite half, closing the outline through the
    // starting disk's two contact points.
    const chainsOut = getChainsBetween(cpStart, cpOpp);
    const chainsBack = getChainsBetween(cpOpp, cpStart);

    let bestChain: CpNode[] | undefined;
    let bestPss: number[][][] | undefined;
    let bestSalience = -Infinity;

    for (const chainOut of chainsOut) {
        for (const chainBack of chainsBack) {
            const cpChain = [...chainOut, ...chainBack.slice(1)];
            const pss = getFatSaliencePss(cpChain);
            const salience = Math.abs(getShapeArea(pss));

            if (salience > bestSalience) {
                bestSalience = salience;
                bestChain = cpChain;
                bestPss = pss;
            }
        }
    }

    if (bestChain === undefined) {
        return undefined;
    }

    return { cpChain: bestChain, pss: bestPss!, roundSalience: bestSalience };
}


interface Fork {
    contacts: CpNode[];
    exit: CpNode;
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

    function walk(chain: CpNode[], forks: Fork[]) {
        for (;;) {
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

    walk([cpFrom], []);

    return chains;
}


export { getFatBranch, getChainsBetween }
