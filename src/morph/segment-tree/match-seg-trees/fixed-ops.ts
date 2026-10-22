import type { SegChild } from './seg-child.js';
import type { SegMatchedPair } from './seg-matched-pair.js';


/**
 * Child matches of a route pair that are already made (a coarser match,
 * refined) - the alignment only decides the remaining children.
 */
interface FixedOps {
    /** matched child pairs, with their (already built) sub-pairs */
    readonly matches: readonly { a: SegChild; b: SegChild; sub: SegMatchedPair }[];
}


/**
 * Returns the fixed matches (`FixedOps`) among a route pair's children.
 *
 * @param chA the children of route A
 * @param chB the children of route B
 */
type FixedOf = (
    chA: SegChild[],
    chB: SegChild[]) => FixedOps;


export type { FixedOps, FixedOf }
