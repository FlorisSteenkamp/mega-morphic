import type { CpNode } from "flo-mat";
import { getShapeArea } from "flo-boolean";
import { generateArcFromCubics } from 'flo-bezier3';
import { getBoundaryBeziersToNext, isOnSameCircle } from "flo-mat";


/**
 * Returns the salience but including the maximal sectors at the endpoints.
 * 
 * @param cpChain a chain of consecutive `CpNodes` 
 * * first and last `CpNode`s must be the same one
 * * can skip around multiprongs to choose any branch
 */
function getRoundSalience(
        cpChain: CpNode[]) {

    const shape = getRoundSaliencePss(cpChain);
    const area = getShapeArea(shape);

    return area;
}


/**
 * Returns the Bezier pieces traced by a closed CpNode chain, including the
 * circular sectors needed when consecutive contacts share a maximal disk.
 */
function getRoundSaliencePss(
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


function getArcBeziersBetween(
        cp: CpNode,
        cpN: CpNode) {

    const { circle, p: pS } = cp.pointOnShape;
    const { center, radius } = circle;

    if (radius === 0) {
        return [];
    }

    const pE = cpN.pointOnShape.p;
    const startAngle = Math.atan2(pS[1] - center[1], pS[0] - center[0]);
    const endAngle = Math.atan2(pE[1] - center[1], pE[0] - center[0]);
    const twoPi = 2 * Math.PI;

    // Chain jumps always follow nextOnCircle, which in the left-handed
    // (y-down) coordinate system sweeps in decreasing atan2 angle.
    const angle = (startAngle - endAngle + twoPi) % twoPi;

    // Coincident contacts (e.g. an interior curvature-max leaf passed
    // through mid-walk) contribute no arc.
    if (angle < 1e-12) {
        return [];
    }

    const segmentCount = Math.ceil(angle / (Math.PI / 2));
    const pss: number[][][] = [];
    for (let i = 0; i < segmentCount; i++) {
        const a0 = startAngle - angle * i / segmentCount;
        const a1 = startAngle - angle * (i + 1) / segmentCount;
        const p0 = i === 0
            ? pS
            : [center[0] + radius * Math.cos(a0), center[1] + radius * Math.sin(a0)];
        const p1 = i === segmentCount - 1
            ? pE
            : [center[0] + radius * Math.cos(a1), center[1] + radius * Math.sin(a1)];
        // generateArcFromCubics sweeps increasing angle, so build backwards.
        const segment = generateArcFromCubics(center, p1, p0)
            .reverse()
            .map(ps => ps.slice().reverse());
        pss.push(...segment);
    }

    return pss;
}


export { getArcBeziersBetween, getChainPss, getRoundSalience, getRoundSaliencePss }
