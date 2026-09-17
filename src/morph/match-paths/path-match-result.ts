import type { MatchedPath } from './matched-path.js';


interface PathMatchResult {
    readonly trunk: MatchedPath;
    /** the chosen tree-2 trunk path is traversed in reverse */
    readonly flipped: boolean;
    readonly cost: number;
}


export type { PathMatchResult }