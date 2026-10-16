import type { Segment } from '../segment.js';
import type { SegMatchedPair } from './seg-matched-pair.js';


/** A matched pair within the match tree. */
interface PairInTree {
    readonly mp: SegMatchedPair;
    /** the matched children's entry segments (`undefined` for the trunk) */
    readonly segA?: Segment;
    readonly segB?: Segment;
    /** DFS-preorder index (= the match / morph views' color index) */
    readonly idx: number;
}


/**
 * All matched pairs of the match tree rooted at `trunk`, in DFS preorder
 * (the trunk first, then each matched child pair's subtree in op order) -
 * the same order `buildMorphEntries` assigns colors in.
 */
function pairsOf(trunk: SegMatchedPair): PairInTree[] {
    const out: PairInTree[] = [];
    const walk = (mp: SegMatchedPair, segA?: Segment, segB?: Segment): void => {
        out.push({ mp, segA, segB, idx: out.length });
        for (const op of mp.ops) {
            if (op.type === 'match') {
                walk(op.sub, op.a.entry, op.b.entry);
            }
        }
    };
    walk(trunk);
    return out;
}


export { pairsOf }
export type { PairInTree }
