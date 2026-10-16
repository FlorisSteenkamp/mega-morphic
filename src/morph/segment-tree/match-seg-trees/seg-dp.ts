import type { SeqOp } from '../../match-paths/align-seq.js';
import type { SegChild } from './seg-child.js';


/** Debug-only: one side's child-alignment DP (Needleman-Wunsch) data. */
interface SegDp {
    readonly side: 1 | -1;
    readonly D: number[][];
    readonly as: SegChild[];
    readonly bs: SegChild[];
    readonly ops: SeqOp<SegChild, SegChild>[];
}


export type { SegDp }
