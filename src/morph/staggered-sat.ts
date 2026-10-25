import type { Circle, CpNode, Mat } from 'flo-mat';
import { toScaleAxis, getRealProngCount } from 'flo-mat';
import { segTreeFromCp } from './segment-tree/seg-tree-from-cp.js';
import { adjOf$ } from './segment-tree/adj-of.js';
import { markSplitDisks, markPhantomForks } from './segment-tree/split-disks.js';


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
const STAGGER_FINE = 1.1;


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
 * * where the coarse SAT cut a branch off a fork, the fork's disk is left a
 *   pass-through disk of the coarse SAT - a phantom fork, marked as a
 *   vertex there too: a coarse route may end at it (`sampleSegTree`), so
 *   the cut branch can be matched as a child there once the fine scale
 *   brings it back
 *
 * * must run before either MAT's segment tree is built
 *
 * @param fine the fine SAT
 */
function prepareStaggered(fine: Mat): Mat {
    const coarse = toScaleAxis(fine, STAGGER_COARSE);

    const phantoms = calcPhantomForks(fine, coarse);
    markSplitDisks(coarse.cpNode, phantoms);
    markPhantomForks(phantoms);

    const adj = adjOf$(segTreeFromCp(coarse.cpNode));
    const leaves = new Set<Circle>();
    for (const [v, segs] of adj) {
        if (segs.length === 1) { leaves.add(v); }
    }

    markSplitDisks(fine.cpNode, leaves);

    return coarse;
}


/**
 * Returns the phantom forks of a coarse SAT: the disks that are forks of
 * the fine SAT (3 or more prongs) but pass-through disks of the coarse one
 * (2 prongs) - where the coarse SAT cut a branch off a fork.
 *
 * * read off the MATs' contact points, not their segment trees (which must
 *   not be built yet)
 *
 * @param fine the fine SAT
 * @param coarse its coarse SAT
 */
function calcPhantomForks(
        fine: Mat,
        coarse: Mat): Set<Circle> {

    const forks = new Set<Circle>();
    forEachCp(fine.cpNode, cp => {
        if (getRealProngCount(cp) >= 3) { forks.add(cp.pointOnShape.circle); }
    });

    const phantoms = new Set<Circle>();
    forEachCp(coarse.cpNode, cp => {
        const circle = cp.pointOnShape.circle;
        if (forks.has(circle) && getRealProngCount(cp) === 2) { phantoms.add(circle); }
    });

    return phantoms;
}


/** Calls `f` with every contact point of the MAT walked from `cpStart`. */
function forEachCp(
        cpStart: CpNode,
        f: (cp: CpNode) => void): void {

    let cp = cpStart;
    do {
        f(cp);
        cp = cp.next;
    } while (cp !== cpStart);
}


export { prepareStaggered, STAGGER_COARSE, STAGGER_FINE }
