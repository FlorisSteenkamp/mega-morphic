import type { MatchedPath } from './matched-path.js';
import type { PooledChild } from './pooled-child.js';


/** An operation on the pooled child forks of a matched path pair. */
type PathChildOp =
    | { type: 'match'; a: PooledChild; b: PooledChild; sub: MatchedPath }
    | { type: 'delete'; a: PooledChild }
    | { type: 'insert'; b: PooledChild };


export type { PathChildOp }