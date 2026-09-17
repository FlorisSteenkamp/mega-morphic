import type { PathPiece } from './path-piece.js';
import type { PooledChild } from './pooled-child.js';
import type { Samples } from './samples.js';


/** A path's composed geometry and derived features. */
interface PathGeom {
    /** composition recipe, start → end */
    readonly pieces: PathPiece[];
    /** composite skeleton, start → end */
    readonly bz: number[][][];
    readonly rd: number[];
    /** total skeleton length */
    readonly L: number;
    /** summed salience of off-path stubs */
    readonly stubSal: number;
    /**
     * number of unmatched regions the stubs create (bypassed pieces plus
     * child subtrees swallowed inside them) - each pays the delete floor,
     * else bypassing a child-rich stretch launders many deletes into one
     * cheap stub
     */
    readonly stubN: number;
    /** on-path child forks (excluding exits) */
    readonly pooled: PooledChild[];
    /** cached full-resolution radius and turning profile */
    samples?: Samples;
    /** cached 48-sample profile used only for trunk beam ranking */
    coarse?: Samples;
}


export type { PathGeom }