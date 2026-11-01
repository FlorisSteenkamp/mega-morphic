import type { CpNode } from 'flo-mat';
import { getShapeArea } from 'flo-boolean';

const { abs, sign } = Math;


/** The shape loops of one component (MAT). */
interface ComponentLoops {
    /** its outer loop */
    readonly outer: number[][][];
    /** its holes' loops, oriented like `outer` (so they measure as shapes) */
    readonly holes: number[][][][];
}


/**
 * Returns the shape loops of the component (MAT) of the given `CpNode`: its
 * outer loop and its holes' loops.
 *
 * * the loops are found by walking the boundary (`next`), which crosses
 *   over to each hole at its hole-closer, so every loop of the component
 *   is visited
 *
 * * the outer loop is the one of the largest area - it encloses the holes
 *
 * @param start any `CpNode` of the component
 */
function getComponentLoops(
        start: CpNode): ComponentLoops {

    const loopSet = new Set<number[][][]>();
    let cp = start;
    do {
        loopSet.add(cp.pointOnShape.curve.loop.beziers);
        cp = cp.next;
    } while (cp !== start);

    const loops = [...loopSet];
    const areas = loops.map(getShapeArea);

    let o = 0;
    for (let i = 1; i < loops.length; i++) {
        if (abs(areas[i]) > abs(areas[o])) { o = i; }
    }

    const holes = loops
        .map((loop, i) => ({ loop, area: areas[i] }))
        .filter((_, i) => i !== o)
        .map(({ loop, area }) =>
            sign(area) === sign(areas[o]) ? loop : reverseLoop(loop));

    return { outer: loops[o], holes };
}


/** Returns the loop walked the other way round. */
function reverseLoop(
        loop: number[][][]): number[][][] {

    return loop.toReversed().map(ps => ps.toReversed());
}


export { getComponentLoops }
export type { ComponentLoops }
