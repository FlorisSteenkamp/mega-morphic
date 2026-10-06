import type { Circle } from 'flo-mat';
import type { Segment } from './segment.js';
import { memoize } from 'flo-memoize';


/**
 * Returns a dense numbering of the tree's vertices, in first-encounter
 * order over the segments (`vertS` then `vertE` of each) - deterministic
 * for a given tree, so usable both as cache/dedupe keys and as the vertex
 * labels of every debug view (matching `showVertexNums`).
 */
const vertexIds = memoize(function(
        tree: Segment[]): Map<Circle, number> {

    const ids = new Map<Circle, number>();
    for (const { vertS, vertE } of tree) {
        ids.getOrInsert(vertS, ids.size);
        ids.getOrInsert(vertE, ids.size);
    }

    return ids;
});


export { vertexIds }
