import type { CpNode } from "flo-mat";
import { getShapeArea } from "flo-boolean";
import { getBoundaryBeziersToNext, isOnSameCircle } from "flo-mat";
import { getArcBeziersBetween } from '../fs/get-arc-beziers-between.js';


/**
 * Returns the salience but including the maximal sectors at the endpoints.
 * 
 * @param cpChain a chain of consecutive `CpNodes` 
 * * first and last `CpNode`s must be the same one
 * * can skip around multiprongs to choose any branch
 */
function getFatSalience(
        cpChain: CpNode[]) {

    const shape = getFatSaliencePss(cpChain);
    const area = getShapeArea(shape);

    return area;
}


/**
 * Returns the Bezier pieces traced by a closed CpNode chain, including the
 * circular sectors needed when consecutive contacts share a maximal disk.
 */
function getFatSaliencePss(
        cpChain: CpNode[]) {

    const cpNode = cpChain[0];
    if (cpNode !== cpChain[cpChain.length-1]) {
        throw new Error("The first and last CpNode must be the same one");
    }

    return getChainPss(cpChain);
}


/**
 * Returns the Bezier pieces traced by a (not necessarily closed) CpNode
 * chain, including the circular sectors needed when consecutive contacts
 * share a maximal disk.
 */
function getChainPss(
        cpChain: CpNode[]) {

    const shape: (number[][])[] = [];

    for (let i=0; i<cpChain.length - 1; i++) {
        const cp = cpChain[i];

        const cpNext = cpChain[i+1];

        if (isOnSameCircle(cp, cpNext)) {
            const sector = getArcBeziersBetween(cp, cpNext);
            shape.push(...sector);
        } else {
            const pss = getBoundaryBeziersToNext(cp);
            shape.push(...pss);
        }
    }

    return shape;
}


export {
    getChainPss, getFatSalience, getFatSaliencePss
}
