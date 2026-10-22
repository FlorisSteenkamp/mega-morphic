import type { Circle, Mat } from 'flo-mat';
import { toScaleAxis } from 'flo-mat';
import { segTreeFromCp } from './segment-tree/seg-tree-from-cp.js';
import { adjOf$ } from './segment-tree/adj-of.js';
import { markSplitDisks } from './segment-tree/split-disks.js';


/**
 * The coarse SAT scale of the staggered SAT: the structure is matched at
 * this scale (keeps the main strokes, a lot of their flesh included).
 */
const STAGGER_COARSE = 2;
/**
 * The fine SAT scale of the staggered SAT: the coarse match is refined at
 * this scale (keeps the visible boundary detail - corners, serif nubs - but
 * not the noise of the plain MAT).
 */
const STAGGER_FINE = 1.05;


/**
 * Returns the coarse SAT (`STAGGER_COARSE`) of a fine SAT, and makes the
 * coarse segment tree an exact sub-tree of the fine one.
 *
 * * the coarse SAT is taken of the fine one, so it is a subset of it,
 *   sharing its vertices (flo-mat's SAT keeps the MAT's `Circle`s)
 *
 * * where the coarse SAT cut a branch, its new leaf is a pass-through disk
 *   of the fine SAT - marked as a vertex there (`markSplitDisks`), so every
 *   coarse segment is a chain of fine ones
 *
 * * must run before the fine MAT's segment tree is built
 *
 * @param fine the fine SAT
 */
function prepareStaggered(fine: Mat): Mat {
    const coarse = toScaleAxis(fine, STAGGER_COARSE);

    const adj = adjOf$(segTreeFromCp(coarse.cpNode));
    const leaves = new Set<Circle>();
    for (const [v, segs] of adj) {
        if (segs.length === 1) { leaves.add(v); }
    }

    markSplitDisks(fine.cpNode, leaves);

    return coarse;
}


export { prepareStaggered, STAGGER_COARSE, STAGGER_FINE }
