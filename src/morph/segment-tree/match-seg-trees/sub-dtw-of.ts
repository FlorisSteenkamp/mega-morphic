import type { Segment } from '../segment.js';
import type { PathCostWeights } from '../../match-paths/path-cost-weights.js';
import type { SegChild } from './seg-child.js';
import type { ProductDtwResult } from '../product-dtw.js';
import { sampleSegTree } from '../sample-seg-tree.js';
import { productDtw } from '../product-dtw.js';
import { lenOfSegs$ } from '../len-of.js';

const { max, min, round } = Math;


/** Pinned-start sub-DTW of a child pair - the relabel core of `matchCost`. */
function subDtwOf(
        gA: Segment[],
        gB: Segment[],
        unitA: number,
        unitB: number,
        δA: number,
        δB: number,
        weights: PathCostWeights,
        sway: number,
        a: SegChild,
        b: SegChild): ProductDtwResult {

    const ssgA = sampleSegTree(
        a.segs, unitA,
        sampleCountFor(lenOfSegs$(a.segs), δA),
        a.attachV
    );

    const ssgB = sampleSegTree(
        b.segs, unitB,
        sampleCountFor(lenOfSegs$(b.segs), δB),
        b.attachV
    );

    return productDtw(ssgA, ssgB, weights, sway);
}


/** sample count for a subtree of length `len` at trunk spacing `δ` */
function sampleCountFor(len: number, δ: number): number {
    return max(8, min(200, round(len / δ)));
}


export { subDtwOf }
