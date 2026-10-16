import type { SegChild } from './seg-child.js';
import type { SegMatchedPair } from './seg-matched-pair.js';


/** One child-alignment decision of a matched route pair. */
type SegOp =
    | { type: 'match'; a: SegChild; b: SegChild; sub: SegMatchedPair }
    | { type: 'delete'; a: SegChild }
    | { type: 'insert'; b: SegChild };


export type { SegOp }
