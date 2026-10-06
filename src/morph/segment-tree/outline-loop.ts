import type { CpNode } from 'flo-mat';
import { getBoundaryBeziersToNext } from 'flo-mat';


/**
 * The glyph's full outline loop (outline direction), walked from any of
 * its `CpNode`s - bezier pieces split at the MAT contact points.
 * 
 * * **not** exactly the same as the original shape loop due to toplogically
 *   altering hole-closers, e.g. a ring is split open at the top, i.e. the
 *   shape's **original** outline loop cut at topological hole-closers
 */
function outlineLoopOf(
        start: CpNode): number[][][] {

    const loop: (number[][])[] = [];
    let cp = start;
    do {
        loop.push(...getBoundaryBeziersToNext(cp));
        cp = cp.next;
    } while (cp !== start);

    return loop;
}


export { outlineLoopOf }
