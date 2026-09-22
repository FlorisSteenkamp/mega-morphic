import type { CpNode } from "flo-mat";
import { generateArcFromCubics } from 'flo-bezier3';


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
            .map(ps => ps.toReversed());
        pss.push(...segment);
    }

    return pss;
}


export { getArcBeziersBetween }
