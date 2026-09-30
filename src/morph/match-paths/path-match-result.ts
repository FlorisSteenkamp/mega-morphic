import type { MatchedPath } from './matched-path.js';
import type { SegGraph } from '../segment-graph/seg-graph.js';


interface PathMatchResult {
    readonly trunk: MatchedPath;
    /** the segment graphs the routes live in (per tree) */
    readonly gA: SegGraph;
    readonly gB: SegGraph;
    /** the chosen tree-2 trunk path is traversed in reverse */
    readonly flipped: boolean;
    readonly cost: number;
}


export type { PathMatchResult }