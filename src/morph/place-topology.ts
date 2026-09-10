import type { FatBranch } from './fat-branch.js';
import type { Glue, EntryResiduals, MutableMorphEntry, SideRes } from './morph-entry.js';
import { length } from 'flo-bezier3';
import { getSkeletonBeziers, getSkeletonRadii } from './get-fat-branch-tree.js';
import { getResidualProfile } from './boundary-residuals.js';
import { getLastP } from './get-last-p.js';
import { evalProfileSide } from './eval-profile-side.js';
import { unionUs } from './union-us.js';
import { boundaries } from './boundaries.js';
import { nearestIdx } from './nearest-idx.js';


/** Which entry a fat branch lives in, and on which side ('a' = shape 1). */
type EntryLoc = { idx: number; side: 'a' | 'b' };


const ZERO_RES: SideRes = { sigma: 1, rT: 0, rN: 0 };


/**
 * Walk a tree parents-first, adding an entry for each unmatched branch:
 * it collapses onto its own junction while its glue keeps that junction
 * riding the parent's drawn skeleton throughout the morph. Chained
 * unmatched branches glue to the (already placed) unmatched parent's entry
 * the same way. `side` is the tree's own frame ('a' = shape 1 for deleted,
 * 'b' = shape 2 for inserted).
 */
function placeTopology(
        root: FatBranch,
        topoSet: Set<FatBranch>,
        side: 'a' | 'b',
        classes: string,
        entryLoc: Map<FatBranch, EntryLoc>,
        bnds: { a?: number[][]; b?: number[][] }[],
        entries: MutableMorphEntry[]) {

    walk(root);

    function walk(parent: FatBranch) {
        for (const edge of parent.children ?? []) {
            const child = edge.branch;

            if (topoSet.has(child)) {
                const bz = getSkeletonBeziers(child);
                const junction = getLastP(bz);  // the child's fork center

                // The parent is in the same tree, so on the same side.
                const loc = entryLoc.get(parent)!;
                const k = nearestIdx(bnds[loc.idx][side]!, junction);
                const glue: Glue = { e1: loc.idx, k1: k, e2: loc.idx, k2: k };

                const collapsed = collapseTo(bz, junction);
                // Radii → 0 so the branch's disks vanish into the fork disk
                // (pinning them to the fork radius made tip disks GROW).
                const radii = getSkeletonRadii(child);
                const rZero = radii.map(() => 0);
                const us = normalizedKnots(bz);

                // Own residual profile on its own side; zero on the other so
                // the boundary relaxes to the bare (collapsing) envelope.
                const prof = getResidualProfile(child);
                const grid = unionUs(us, prof.us);
                const own = {
                    out: grid.map(u => evalProfileSide(prof.us, prof.out, u)),
                    back: grid.map(u => evalProfileSide(prof.us, prof.back, u)),
                };
                const zero = grid.map(() => ZERO_RES);
                const residuals: EntryResiduals = side === 'a'
                    ? { us: grid, outA: own.out, backA: own.back,
                        outB: zero, backB: zero }
                    : { us: grid, outA: zero, backA: zero,
                        outB: own.out, backB: own.back };

                entryLoc.set(child, { idx: entries.length, side });
                bnds.push(side === 'a'
                    ? { a: boundaries(bz) }
                    : { b: boundaries(bz) });
                entries.push(side === 'a'
                    ? { a: bz, b: collapsed, ra: radii, rb: rZero, us, residuals, classes, glue }
                    : { a: collapsed, b: bz, ra: rZero, rb: radii, us, residuals, classes, glue }
                );
            }

            walk(child);
        }
    };
}


/** Normalized arc-length position of each segment boundary. */
function normalizedKnots(beziers: number[][][]): number[] {
    const lengths = beziers.map(ps => length([0, 1], ps));
    const total = lengths.reduce((s, l) => s + l, 0);
    const knots = [0];
    let cum = 0;
    for (const l of lengths) {
        cum += l;
        knots.push(total === 0 ? 0 : cum / total);
    }
    knots[knots.length - 1] = 1;

    return knots;
}


function collapseTo(beziers: number[][][], pt: number[]) {
    return beziers.map(ps => ps.map(() => [pt[0], pt[1]]));
}


export type { EntryLoc }
export { placeTopology }
