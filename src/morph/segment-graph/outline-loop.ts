import type { CpNode } from 'flo-mat';
import { getBoundaryBeziersToNext } from 'flo-mat';


/** The glyph's full outline loop (outline direction), walked from any of
 *  its CpNodes - bezier pieces split at the MAT contact points. */
function outlineLoopOf(start: CpNode): number[][][] {
    const out: number[][][] = [];
    let cp = start;
    do {
        out.push(...getBoundaryBeziersToNext(cp));
        cp = cp.next;
    } while (cp !== start);
    return out;
}


export { outlineLoopOf }
