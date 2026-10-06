import type { CpNode } from "flo-mat";
import type { FatBranch } from './fat-branch.js';
import { getRealProngCount, isOnSameCircle } from "flo-mat";
import { getShapeArea } from "flo-boolean";
import { getChainsBetween } from './get-chains-between.js';
import { getFattestOfChains } from './get-fattest-of-chains.js';
import { getChainPss } from './get-chain-pss.js';
import { getFirstLeafFrom } from './get-first-leaf-from.js';

const { abs, PI: π } = Math;


/**
 * * **Debug only**
 * 
 * A completed downward arm of a fork: a decided sector chain to a leaf.
 */
interface Arm {
    /** the arm's path region area (flesh + passed disks), capped at its fork */
    readonly salience: number;
    /** decided chain from the arm's sector start to its sector end contact */
    readonly chain: CpNode[];
    /** tour order of the arm's sector (for reassembling the winner) */
    readonly order: number;
}


/**
 * * **Debug only**
 * 
 * An open fork (or the root leaf edge) frame of the boundary tour.
 * */
interface Frame {
    /** contact first arrived at from the parent side; `undefined` for root */
    readonly arrivalCp: CpNode | undefined;
    /** last contact before returning to the parent (arrival's prevOnCircle) */
    readonly returnCp: CpNode | undefined;
    readonly diskArea: number;
    /** current sector's chain, nested fork resolved to its best arm */
    decided: CpNode[];
    /** current sector's chain, nested fork skipped entirely (distal arc) */
    skipped: CpNode[];
    /** best-arm salience of the current sector's nested fork (if any) */
    nestedSalience: number;
    /** tour order of the current sector */
    order: number;
    best: Arm | undefined;
    second: Arm | undefined;
}


/**
 * * **Debug only**
 * 
 * Returns the fattest (maximal round salience) tip-to-tip fat branch of the
 * entire shape.
 *
 * Single boundary tour from an arbitrary leaf: the tour is a DFS of the
 * unrooted fork tree (forks = nodes, flesh between fork circles = edges).
 * Salience decomposes exactly - edge flesh + full disks of passed forks -
 * so the fattest leaf-to-leaf path is found tree-diameter style: keep the
 * best two downward arms per fork, no chain enumeration.
 */
function getFatBranch(
        cpNode: CpNode): FatBranch | undefined {

    if (getRealProngCount(cpNode) !== 2) {
        return undefined;
    }

    const leaf = getFirstLeafFrom(cpNode);
    if (leaf === undefined) { return undefined; }

    // The tour runs from the tip's far-side contact around the whole shape
    // back to the tip's arrival contact.
    const cpS = leaf.prevOnCircle;
    const cpE = leaf;

    const root = makeFrame(undefined, cpS);
    const frames: Frame[] = [root];

    let bestSalience = -Infinity;
    let bestChain: CpNode[] | undefined;

    let cp = cpS;
    while (true) {
        cp = cp.next;
        const top = frames[frames.length - 1];

        // Back on the current fork's circle: its current sector is complete.
        if (top.arrivalCp !== undefined && isOnSameCircle(cp, top.arrivalCp)) {
            append(top, cp);

            const salience =
                abs(getShapeArea(getChainPss(top.skipped, true))) +
                top.nestedSalience;
            const arm: Arm = { salience, chain: top.decided, order: top.order };
            if (top.best === undefined || salience > top.best.salience) {
                top.second = top.best;
                top.best = arm;
            } else if (top.second === undefined || salience > top.second.salience) {
                top.second = arm;
            }

            if (cp !== top.returnCp) {
                // The next sector starts here.
                top.decided = [cp];
                top.skipped = [cp];
                top.nestedSalience = 0;
                top.order++;
                continue;
            }

            // All sectors toured - pop and resolve into the parent.
            frames.pop();
            const parent = frames[frames.length - 1];
            const { best, second, diskArea } = top;

            // Candidate: the fattest path having this fork as its apex.
            if (second !== undefined) {
                const total = diskArea + best!.salience + second.salience;
                if (total > bestSalience) {
                    bestSalience = total;
                    const [a, b] = best!.order < second.order
                        ? [best!, second]
                        : [second, best!];
                    // Closed outline; same-circle gaps become skip arcs.
                    bestChain = [...a.chain, ...b.chain, a.chain[0]];
                }
            }

            // The parent's downward path continues into this fork's best arm.
            for (const c of best!.chain) { append(parent, c, 'decided'); }
            append(parent, cp, 'decided');
            append(parent, cp, 'skipped');
            parent.nestedSalience += best!.salience;
            continue;
        }

        // Tour complete: root candidate (a path ending at the start leaf).
        if (cp === cpE) {
            append(root, cp);
            const salience =
                abs(getShapeArea(getChainPss(root.skipped, false))) +
                root.nestedSalience;
            if (salience > bestSalience) {
                bestSalience = salience;
                bestChain = root.decided;
            }
            break;
        }

        if (cp === cpS) { return undefined; }  // malformed MAT - safety

        // A new fork: descend into it.
        if (getRealProngCount(cp) >= 3) {
            append(top, cp);
            frames.push(makeFrame(cp, cp));
            continue;
        }

        // An ordinary boundary contact.
        append(top, cp);
    }

    if (bestChain === undefined) { return undefined; }

    return {
        cpChain: bestChain,
        pss: getChainPss(bestChain, false),
        children: []
    };
}


/**
 * * **Debug only**
 */
function makeFrame(
        arrivalCp: CpNode | undefined,
        startCp: CpNode): Frame {

    const radius = arrivalCp === undefined
        ? 0
        : arrivalCp.pointOnShape.circle.radius;

    return {
        arrivalCp,
        returnCp: arrivalCp?.prevOnCircle,
        diskArea: π * radius * radius,
        decided: [startCp],
        skipped: [startCp],
        nestedSalience: 0,
        order: 0,
        best: undefined,
        second: undefined
    };
}


/**
 * * **Debug only**
 * 
 * Appends to the frame's chains without consecutive duplicates.
 */
function append(
        frame: Frame,
        cp: CpNode,
        only?: 'decided' | 'skipped'): void {

    if (only !== 'skipped') {
        const d = frame.decided;
        if (d[d.length - 1] !== cp) { d.push(cp); }
    }
    if (only !== 'decided') {
        const s = frame.skipped;
        if (s[s.length - 1] !== cp) { s.push(cp); }
    }
}


/**
 * * **Debug only**
 */
function getFatBranchNaive(
        cpNode: CpNode): FatBranch | undefined {

    if (getRealProngCount(cpNode) !== 2) {
        return undefined;
    }

    // Walk the boundary to a leaf (terminating contact).
    const leaf = getFirstLeafFrom(cpNode)!;

    // Turn around at the tip: every candidate outline is a single closed
    // chain from the tip's far-side contact back to its arrival contact.
    // const chains = getChainsBetween(leaf.nextOnCircle, leaf);
    const chains = getChainsBetween(leaf.prevOnCircle, leaf);

    return getFattestOfChains(chains, false);
}


export { getFatBranch }
