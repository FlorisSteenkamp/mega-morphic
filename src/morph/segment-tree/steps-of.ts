import type { CpNode } from 'flo-mat';
import type { Segment } from './segment.js';
import { isSegVertex } from './split-disks.js';
import { memoize } from 'flo-memoize';


/**
 * The segment's MAT walk: its outline steps `cp` → `cp.next`, from the
 * segment start through the pass-through disks (`cp.next` just carries on)
 * up to the step that arrives at the next fork/leaf disk (or a disk marked
 * as a vertex - `isSegVertex`).
 *
 * * a disk's degree is its real prong count: 1 = leaf tip, 2 = pass-
 *   through, 3+ = fork
 */
const stepsOf$ = memoize(function(
        seg: Segment): CpNode[] {

    const steps: CpNode[] = [];
    let cp: CpNode = seg;
    while (true) {
        steps.push(cp);
        if (isSegVertex(cp.next)) { break; }
        cp = cp.next;
    }

    return steps;
});


export { stepsOf$ }
