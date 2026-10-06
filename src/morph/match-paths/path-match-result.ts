import type { SegMatchedPair } from '../segment-tree/match-seg-trees.js';
import type { Segment } from '../segment-tree/segment.js';


interface PathMatchResult {
    readonly trunk: SegMatchedPair;
    /** the segment trees the routes live in (per tree) */
    readonly gA: Segment[];
    readonly gB: Segment[];
    readonly loopA: number[][][];
    readonly loopB: number[][][];
    readonly cost: number;
}


export type { PathMatchResult }
