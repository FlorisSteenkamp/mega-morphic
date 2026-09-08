import type { CpNode } from "flo-mat";
import {
    getAllOnCircle, getBoundaryBeziersToNext, getBranch,
    getRealProngCount, isOnSameCircle
} from "flo-mat";
import { getShapeArea } from "flo-boolean";
import { getArcBeziersBetween, getRoundSaliencePss } from "./get-round-salience.js";
import { FatBranch } from "./fat-branch.js";


interface HalfWalk {
    readonly chain: CpNode[];
    readonly area: number;  // signed Green's contribution of the walked pieces
}


/**
 * Returns the fat branch with the largest area over all possible starting
 * `CpNode`s on the shape (assumed a Jordan curve).
 *
 * Each sector of the shape is walked only once (memoized per contact point);
 * one representative per MAT branch suffices since all `CpNode`s on the same
 * branch yield the same candidate fat branches.
 */
function getFattestBranch(
        cpNode: CpNode): FatBranch | undefined {

    // One walk around the loop: collect a representative 2-prong per branch
    // and accumulate the loop's signed area for orientation.
    const marked = new Set<CpNode>();
    const reps: CpNode[] = [];
    let loopArea = 0;
    let cp = cpNode;
    do {
        loopArea += getShapeArea(getBoundaryBeziersToNext(cp));
        if (getRealProngCount(cp) === 2 && !marked.has(cp)) {
            reps.push(cp);
            for (const b of getBranch(cp)) {
                for (const c of getAllOnCircle(b)) { marked.add(c); }
            }
        }
        cp = cp.next;
    } while (cp !== cpNode);

    const sign = loopArea >= 0 ? 1 : -1;
    const memo = new Map<CpNode, HalfWalk>();
    // Sectors currently being walked; re-entry means the Jordan-curve
    // assumption is violated (e.g. hole-closers) - poison that candidate.
    const inProgress = new Set<CpNode>();

    /**
     * Best walk from contact `s` to `s.nextOnCircle` (the boundary's next
     * contact on the same circle - holds for Jordan curves), choosing the
     * sector with maximal oriented area at each fork encountered.
     */
    function walkSector(s: CpNode): HalfWalk | undefined {
        const memoized = memo.get(s);
        if (memoized !== undefined) { return memoized; }
        if (inProgress.has(s)) { return undefined; }
        inProgress.add(s);

        const target = s.nextOnCircle;
        const chain: CpNode[] = [s];
        let area = 0;
        let cp = s;
        let steps = 0;

        while (cp !== target) {
            if (++steps > 200_000) {
                inProgress.delete(s);
                return undefined;
            }

            if (cp !== s && getRealProngCount(cp) >= 3) {
                const exit = cp.prevOnCircle;

                let bestChoice: HalfWalk | undefined;
                for (const contact of getAllOnCircle(cp)) {
                    if (contact === exit) { continue; }

                    const sector = walkSector(contact);
                    if (sector === undefined) { continue; }

                    const sectorEnd = contact.nextOnCircle;
                    let a = sector.area;
                    const ext: CpNode[] = [];

                    if (contact === cp) {
                        ext.push(...sector.chain.slice(1));
                    } else {
                        a += getShapeArea(getArcBeziersBetween(cp, contact));
                        ext.push(...sector.chain);
                    }
                    if (sectorEnd !== exit) {
                        a += getShapeArea(getArcBeziersBetween(sectorEnd, exit));
                        ext.push(exit);
                    }

                    if (bestChoice === undefined || sign*a > sign*bestChoice.area) {
                        bestChoice = { chain: ext, area: a };
                    }
                }

                if (bestChoice === undefined) {
                    inProgress.delete(s);
                    return undefined;
                }

                area += bestChoice.area;
                chain.push(...bestChoice.chain);

                // Step off the exit contact immediately - it is on the fork
                // circle too and would otherwise re-enter the fork forever.
                cp = exit;
                if (cp === target) { continue; }
                const exitPieces = isOnSameCircle(cp, cp.next)
                    ? getArcBeziersBetween(cp, cp.next)
                    : getBoundaryBeziersToNext(cp);
                area += getShapeArea(exitPieces);
                chain.push(cp.next);
                cp = cp.next;
                continue;
            }

            const pieces = isOnSameCircle(cp, cp.next)
                ? getArcBeziersBetween(cp, cp.next)
                : getBoundaryBeziersToNext(cp);
            area += getShapeArea(pieces);
            chain.push(cp.next);
            cp = cp.next;
        }

        const result: HalfWalk = { chain, area };
        memo.set(s, result);
        inProgress.delete(s);

        return result;
    }

    let bestArea = -Infinity;
    let bestChain: CpNode[] | undefined;

    for (const rep of reps) {
        // For a 2-prong the opposite contact is both nextOnCircle and
        // prevOnCircle, so the two sector walks are the fat branch halves.
        const half1 = walkSector(rep);
        const half2 = walkSector(rep.prevOnCircle);
        if (half1 === undefined || half2 === undefined) { continue; }

        const area = sign * (half1.area + half2.area);

        if (area > bestArea) {
            bestArea = area;
            bestChain = [...half1.chain, ...half2.chain.slice(1)];
        }
    }

    if (bestChain === undefined) {
        return undefined;
    }

    return {
        cpChain: bestChain,
        pss: getRoundSaliencePss(bestChain),
        roundSalience: bestArea
    };
}


export { getFattestBranch }
