import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';


/**
 * Returns the weights a child pair's sub-DTW runs with: the gap opening
 * scaled by the pair's mean material (its salience fraction - a whole glyph
 * is about `1`).
 *
 * * every other DTW cost scales with the material aligned (steps by length
 *   and radius, extensions by the gapped material) - a flat gap opening
 *   would not: a single unavoidable gap (sample counts differing by one)
 *   would outprice dropping a small branch outright, so small branches
 *   never matched
 *
 * * so a child pair is priced like a scaled-down glyph pair
 */
function calcSubWeights(
        weights: PathCostWeights,
        a: SegChild,
        b: SegChild): PathCostWeights {

    const m = (a.material + b.material)/2;

    return { ...weights, gapOpen: weights.gapOpen*m };
}


export { calcSubWeights }
