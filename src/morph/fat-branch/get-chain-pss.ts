import type { CpNode } from "flo-mat";
import { getBoundaryBeziersToNext, isOnSameCircle } from "flo-mat";
import { getArcBeziersBetween } from '../fs/get-arc-beziers-between.js';


/**
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
            shape.push(...sector);
        } else {
            const pss = getBoundaryBeziersToNext(cp);
            shape.push(...pss);
        }
    }

    const cpS = cpChain[0];
    const cpE = cpChain[cpChain.length - 1];
    if (cpS === cpE) {
        return shape;  // it is a closed chain; cap is always distal
    }

    // A cap must run from cpE back to cpS; getArcBeziersBetween sweeps
    // nextOnCircle from its first argument.
    const capPss = invertCap
        ? getArcBeziersBetween(cpS, cpE).toReversed().map(ps => ps.toReversed())
        : cpS === cpE.next
            ? getBoundaryBeziersToNext(cpE)
            : getArcBeziersBetween(cpE, cpS);

    shape.push(...capPss);

    return shape;
}


export { getChainPss }
