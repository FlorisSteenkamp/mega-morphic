/**
 * Where a morph entry's junction end (the last point of its beziers) is
 * attached: on parent entry `e`, at boundary `k1` in frame A (t=0) and at
 * boundary `k2` in frame B (t=1) - the junction slides from `k1` to `k2`.
 *
 * At draw time the whole
 * entry is translated so its junction rides the parent's *drawn* skeleton
 * throughout the morph (the translation vanishes at t=0 and t=1).
 */
interface Glue {
    readonly e: number;
    readonly k1: number;
    readonly k2: number;
}


export type { Glue }
