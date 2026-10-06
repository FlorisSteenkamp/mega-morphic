import type { CpNode, Circle } from 'flo-mat';
import type { Segment } from './segment.js';
import { getMatCurveToNext, getBoundaryBeziersToNext, getRealProngCount } from 'flo-mat';
import { segmentArea } from './segment-area.js';


/**
 * Builds and returns the segment tree (as its segments - see `Segment`)
 * directly from the MAT, in one walk around the outline
 *
 * * each outline step `cp` → `cp.next` runs alongside one skeleton edge,
 *   from `cp`'s maximal disk to `cp.next`'s (same-disk steps are leaf-tip
 *   caps, not edges). The outline runs along BOTH sides of the skeleton,
 *   so every edge is met twice, in opposite directions - and the MAT links
 *   the two directly: the opposite-side step of `cp` is
 *   `cp.next.prevOnCircle` (its twin). The step gives the edge's `out`
 *   sleeve, the twin its `back` sleeve.
 *
 * * a disk's degree is its real prong count: 1 = leaf tip, 2 = pass-
 *   through, 3+ = fork. Leaving a fork/leaf disk, the walk follows the
 *   stroke through pass-through disks (`cp.next` just carries on) to the
 *   next fork/leaf disk: that run of steps is one segment. Marking each
 *   step AND its twin as consumed makes the other side of the same stroke
 *   skip when the walk gets there, so every segment is emitted once - from
 *   whichever end the walk reaches first, which fixes its direction.
 *
 * * circles are compared by identity - flo-mat shares one `Circle` object
 *   per MAT vertex (on-circle ring; hole-closer twins get their own)
 */
function segTreeFromCp(
        cpStart: CpNode): Segment[] {

    const segments: Segment[] = [];

    /** steps already part of an emitted segment (either side) */
    const consumed = new Set<CpNode>();

    /** degree per disk, cached (the prong count walks the disk's ring) */
    const degrees = new Map<Circle, number>();
    const isVertexDisk = (cp: CpNode): boolean =>
        degrees.getOrInsertComputed(cp.pointOnShape.circle,
            () => getRealProngCount(cp)) !== 2;

    let cp = cpStart;
    do {
        if (consumed.has(cp) || isCap(cp) || !isVertexDisk(cp)) {
            cp = cp.next;
            continue;
        }

        // `cp` leaves a fork/leaf disk: walk the stroke to the next one
        const skelPss: number[][][] = [];
        const radii = [cp.pointOnShape.circle.radius];
        const sleeves: { out: number[][][]; back: number[][][] }[] = [];

        let step = cp;
        while (true) {
            const twin = step.next.prevOnCircle;
            consumed.add(step);
            consumed.add(twin);

            radii.push(step.next.pointOnShape.circle.radius);
            skelPss.push(getMatCurveToNext(step));
            sleeves.push({
                out: getBoundaryBeziersToNext(step),
                back: getBoundaryBeziersToNext(twin)
            });

            if (isVertexDisk(step.next)) { break; }
            step = step.next;
        }

        const vertS = cp.pointOnShape.circle;
        const vertE = step.next.pointOnShape.circle;
        const material = segmentArea(vertS, vertE, sleeves);

        segments.push({
            vertS,
            vertE,
            skelPss,
            radii,
            material,
            sleeves
        });

        cp = cp.next;
    } while (cp !== cpStart);

    return segments;
}


/** A same-disk outline step (leaf-tip cap): not a skeleton edge. */
function isCap(cp: CpNode): boolean {
    return cp.pointOnShape.circle === cp.next.pointOnShape.circle;
}


export { segTreeFromCp }
