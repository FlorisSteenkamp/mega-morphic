import type { CpNode } from 'flo-mat';
import type { Segment } from './segment.js';
import { isSegVertex } from './split-disks.js';
import { stepsOf$ } from './steps-of.js';


/**
 * Builds and returns the segment tree (as its segments - see `Segment`)
 * directly from the MAT, in one walk around the outline
 *
 * * a segment starts at every outline step that leaves a fork/leaf disk or
 *   one marked as a vertex (`isSegVertex`), not a leaf-tip cap (a same-disk
 *   step). The outline runs along BOTH
 *   sides of the skeleton, so each segment is met twice, once per side:
 *   marking a segment's steps AND their twins (`cp.next.prevOnCircle`, the
 *   opposite-side steps) as consumed makes the other side skip when the
 *   walk gets there, so every segment is emitted once - from whichever end
 *   the walk reaches first, which fixes its direction.
 *
 * * circles are compared by identity - flo-mat shares one `Circle` object
 *   per MAT vertex (on-circle ring; hole-closer twins get their own)
 */
function segTreeFromCp(
        cpStart: CpNode): Segment[] {

    const segments: Segment[] = [];

    /** steps already part of an emitted segment (either side) */
    const consumed = new Set<CpNode>();

    let cp = cpStart;
    do {
        if (!consumed.has(cp) && !isCap(cp) && isSegVertex(cp)) {
            const seg = cp as Segment;
            for (const step of stepsOf$(seg)) {
                consumed.add(step);
                consumed.add(step.next.prevOnCircle);
            }
            segments.push(seg);
        }

        cp = cp.next;
    } while (cp !== cpStart);

    return segments;
}


/** A same-disk outline step (leaf-tip cap): not a skeleton edge. */
function isCap(cp: CpNode): boolean {
    return cp.pointOnShape.circle === cp.next.pointOnShape.circle;
}


export { segTreeFromCp }
