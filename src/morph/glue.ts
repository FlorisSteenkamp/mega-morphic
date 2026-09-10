
/**
 * Where a morph entry's junction end (the last point of its beziers) is
 * attached.
 * 
 * In frame 1 (t=0) it sits at boundary `k1` of entry `e1`;
 * in frame 2 (t=1) at boundary `k2` of entry `e2`.
 * 
 * At draw time the whole
 * entry is translated so its junction rides the parent's *drawn* skeleton
 * throughout the morph (the translation vanishes at t=0 and t=1).
 */
interface Glue {
    readonly e1: number;
    readonly k1: number;
    readonly e2: number;
    readonly k2: number;
}


export type { Glue }
