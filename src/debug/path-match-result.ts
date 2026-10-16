import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { Segment } from '../morph/segment-tree/segment.js';


/**
 * Debug-only record of the last path match: the matched pair tree plus
 * the inputs it was computed from, for the match overlay and logs.
 */
interface PathMatchResult {
    readonly trunk: SegMatchedPair;
    /** the segment trees the routes live in (per tree) */
    readonly gA: Segment[];
    readonly gB: Segment[];
    readonly loopA: number[][][];
    readonly loopB: number[][][];
}


export type { PathMatchResult }
