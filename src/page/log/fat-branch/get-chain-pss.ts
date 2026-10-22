import type { CpNode } from "flo-mat";
import { getBoundaryBeziersToNext, isOnSameCircle } from "flo-mat";
import { getArcBeziersBetween } from './get-arc-beziers-between.js';

/** a gap between consecutive pieces wider than this is bridged */
const BRIDGE_EPS = 1e-6;


/**
 * * **Debug only**
 * 
 * Returns the Bezier pieces traced by a (not necessarily closed) CpNode
 * chain, including the circular sectors needed when consecutive contacts
 * share a maximal disk.
 * 
 * @param invertCap set to `true` to invert the endcap arc (for open chains);
 * closed chains are always capped with a distal endcap arc
 */
function getChainPss(
        cpChain: CpNode[],
        invertCap: boolean) {

    const shape: (number[][])[] = [];

    for (let i=0; i<cpChain.length - 1; i++) {
        const cp = cpChain[i];

        const cpNext = cpChain[i+1];

        if (cpNext !== cp.next &&
            isOnSameCircle(cp, cpNext)) {

            const sector = getArcBeziersBetween(cp, cpNext);
            pushBridged(shape, sector, true);
        } else {
            const pss = getBoundaryBeziersToNext(cp);
            pushBridged(shape, pss, true);
        }
    }

    const cpS = cpChain[0];
    const cpE = cpChain[cpChain.length - 1];
    if (cpS === cpE) {
        // it is a closed chain; cap is always distal
        if (shape.length > 0) { pushBridged(shape, [shape[0]], false); }
        return shape;
    }

    // A cap must run from cpE back to cpS; getArcBeziersBetween sweeps
    // nextOnCircle from its first argument.
    const capPss = invertCap
        ? getArcBeziersBetween(cpS, cpE).toReversed().map(ps => ps.toReversed())
        : cpS === cpE.next
            ? getBoundaryBeziersToNext(cpE)
            : getArcBeziersBetween(cpE, cpS);

    pushBridged(shape, capPss, true);
    if (shape.length > 0) { pushBridged(shape, [shape[0]], false); }

    return shape;
}


/**
 * Appends the pieces to the shape, bridging any jump between consecutive
 * pieces with a straight line:
 *
 * * across a hole-closing disk (the outline walks from the outer contour
 *   onto a hole's), where the MAT gives no boundary piece
 *
 * * at the ends of disk arcs, which are built from the disk's center and
 *   radius, so they miss the contact points by float error
 *
 * * so the outline stays one continuous loop: drawn as a single path, a
 *   jump would start a new subpath, and each subpath is filled on its own
 *
 * * a hole-closing cut is walked once each way, so its lines add no area
 *
 * @param shape the shape so far
 * @param pss the pieces to append
 * @param append whether to append them (`false`: only bridge to their start)
 */
function pushBridged(
        shape: number[][][],
        pss: number[][][],
        append: boolean): void {

    for (const ps of pss) {
        const last = shape[shape.length - 1];
        if (last !== undefined) {
            const p = last[last.length - 1];
            const q = ps[0];
            if (Math.hypot(q[0] - p[0], q[1] - p[1]) > BRIDGE_EPS) {
                shape.push([p, q]);
            }
        }

        if (!append) { return; }
        shape.push(ps);
    }
}


export { getChainPss }
