import type { SeqOp } from '../../match-paths/align-seq.js';
import type { SegChild } from './seg-child.js';


/**
 * Debug-only: the cyclic child-alignment DP (Needleman-Wunsch) data, in the
 * winning rotation of `as`.
 */
interface SegDp {
    readonly D: number[][];
    readonly as: SegChild[];
    readonly bs: SegChild[];
    readonly ops: SeqOp<SegChild, SegChild>[];
}


export type { SegDp }
