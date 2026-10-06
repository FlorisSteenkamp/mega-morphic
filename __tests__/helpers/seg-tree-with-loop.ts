import type { CpNode } from 'flo-mat';
import type { Segment } from '../../src/morph/segment-tree/segment.js';
import { segTreeFromCp } from '../../src/morph/segment-tree/seg-tree-from-cp.js';
import { outlineLoopOf } from '../../src/morph/segment-tree/outline-loop.js';


/** each test tree's outline loop (the app passes loops alongside) */
const loops = new WeakMap<Segment[], number[][][]>();


/** `segTreeFromCp`, remembering the tree's outline loop for `loopOf`. */
function segTreeWithLoop(cp: CpNode): Segment[] {
    const g = segTreeFromCp(cp);
    loops.set(g, outlineLoopOf(cp));

    return g;
}


/** The outline loop of a tree built by `segTreeWithLoop`. */
function loopOf(g: Segment[]): number[][][] {
    return loops.get(g)!;
}


export { segTreeWithLoop, loopOf }
