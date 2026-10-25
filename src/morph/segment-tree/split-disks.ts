import type { Circle, CpNode } from 'flo-mat';
import { getRealProngCount } from 'flo-mat';


/**
 * The contact points of pass-through disks that are segment-tree vertices
 * all the same (`markSplitDisks`) - per MAT, as its `CpNode`s are its own.
 */
const splitNodes = new WeakSet<CpNode>();

/**
 * The phantom forks (`markPhantomForks`) - by disk, so shared by a SAT and
 * the coarser SATs taken of it (a phantom fork is a real fork of the finer
 * one, an end there anyway).
 */
const phantomForks = new WeakSet<Circle>();


/**
 * Marks the given disks of the MAT (walked from `cpStart`) as segment-tree
 * vertices even where they are pass-through disks (2 prongs): segments are
 * cut there (`isSegVertex`).
 *
 * * used to make a coarser SAT's tree an exact sub-tree of a finer one: a
 *   coarse leaf (where the coarse SAT cut a branch) is a pass-through disk
 *   of the finer SAT
 *
 * * must be done before the MAT's segment tree is built (`segTreeFromCp`,
 *   `stepsOf$` are memoized)
 *
 * @param cpStart a contact point of the MAT
 * @param disks the disks to cut at
 */
function markSplitDisks(
        cpStart: CpNode,
        disks: Set<Circle>): void {

    let cp = cpStart;
    do {
        if (disks.has(cp.pointOnShape.circle)) { splitNodes.add(cp); }
        cp = cp.next;
    } while (cp !== cpStart);
}


/**
 * Returns `true` if the contact point's disk is a segment-tree vertex: a
 * leaf tip, a fork, or a disk marked by `markSplitDisks`.
 */
function isSegVertex(cp: CpNode): boolean {
    return getRealProngCount(cp) !== 2 || splitNodes.has(cp);
}


/**
 * Marks the given disks as phantom forks: forks of a finer SAT that a
 * coarser one passes through (it cut their branch away) - a route may end
 * there (`isPhantomFork`, `sampleSegTree`).
 *
 * * the disks must be segment-tree vertices too (`markSplitDisks`)
 *
 * @param disks the phantom forks
 */
function markPhantomForks(disks: Set<Circle>): void {
    for (const disk of disks) { phantomForks.add(disk); }
}


/** Returns `true` if the disk was marked as a phantom fork. */
function isPhantomFork(disk: Circle): boolean {
    return phantomForks.has(disk);
}


export { markSplitDisks, isSegVertex, markPhantomForks, isPhantomFork }
