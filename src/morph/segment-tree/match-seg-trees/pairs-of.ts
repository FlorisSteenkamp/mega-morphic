import type { Circle } from 'flo-mat';
import type { Segment } from '../segment.js';
import type { SegMatchedPair } from './seg-matched-pair.js';


/** A matched pair within the match tree. */
interface PairInTree {
    readonly mp: SegMatchedPair;
    /** the matched children's entry segments (`undefined` for the trunk) */
    readonly segA?: Segment;
    readonly segB?: Segment;
    /** the matched children's junctions (`undefined` for the trunk) */
    readonly attachA?: Circle;
    readonly attachB?: Circle;
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
    const walk = (
            mp: SegMatchedPair,
            segA?: Segment,
            segB?: Segment,
            attachA?: Circle,
            attachB?: Circle): void => {

        out.push({ mp, segA, segB, attachA, attachB, idx: out.length });
        for (const op of mp.ops) {
            if (op.type === 'match') {
                walk(op.sub, op.a.entry, op.b.entry, op.a.attachV, op.b.attachV);
            }
        }
    };
    walk(trunk);
    return out;
}


export { pairsOf }
export type { PairInTree }
