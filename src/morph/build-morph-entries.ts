import type { FatBranch } from './fat-branch/fat-branch.js';
import type { MorphEntry, MutableMorphEntry } from './morph-entry.js';
import { matchTrees } from './match-trees/match-trees.js';
import { distributeBezierListsWithRadii } from './distribute-beziers-evenly.js';
import { getSkeletonBeziers, getSkeletonRadii } from './fat-branch/get-fat-branch-tree.js';
import { buildSleeveSides, getEdgeSleeves, skeletonKnots } from './anchored-sleeves.js';
import { getLastP } from './fs/get-last-p.js';
import { getParentMap } from './get-parent-map.js';
import { getShapeArea } from 'flo-boolean';
import { matchColors } from '../page/events/match-colors.js';
import { nearestIdx } from './nearest-idx.js';


type EntryLoc = { idx: number; side: 'a' | 'b' };

/**
 * Matches the two fat branch trees and builds the full set of morph entries:
 * resampled matched pairs plus collapsing deleted/inserted branches, all
 * glued so junctions stay attached throughout the morph.
 *
 * @param matchColorsList colors cycled through for the matched pairs
 */
function buildMorphEntries(
        tree1: FatBranch,
        tree2: FatBranch): MorphEntry[] {

    const matchedTrees = matchTrees(tree1, tree2);

    // The sleeves walk the outline in its global direction - the trunk's
    // (mostly boundary) loop gives a reliable winding for the cap arcs.
    // Small child branches cannot: their closing sector arc is reversed and
    // can dominate, flipping their pss winding.
    const capSign = getShapeArea(tree1.pss) < 0 ? -1 : 1;

    const entries: MutableMorphEntry[] = [];
    /** entry location of every fat branch */
    const entryLoc = new Map<FatBranch, EntryLoc>();
    /** per entry: its resampled segment boundary points, per side */
    const bnds: { a?: number[][]; b?: number[][] }[] = [];

    // Matched pairs: resample for correspondence, morph shape1 → shape2.
    matchedTrees.pairs.forEach(([fbA, fbB], i) => {
        const bzA = getSkeletonBeziers(fbA);
        let bzB = getSkeletonBeziers(fbB);
        const rdA = getSkeletonRadii(fbA);
        let rdB = getSkeletonRadii(fbB);

        // Boundary pieces per original skeleton edge, per side.
        const edgesA = getEdgeSleeves(fbA);
        let edgesB = getEdgeSleeves(fbB);

        // Flipped trunk: traverse tree2's trunk from its other tip - reverse
        // its skeleton; its edge sleeves reverse order and swap sides (the
        // boundary geometry itself keeps its outline direction).
        if (i === 0 && matchedTrees.flipped) {
            bzB = bzB.map(ps => [...ps].reverse()).reverse();
            rdB = [...rdB].reverse();
            edgesB = [...edgesB].reverse()
                .map(e => ({ out: e.back, back: e.out }));
        }

        const [m1, m2] = distributeBezierListsWithRadii(bzA, rdA, bzB, rdB);

        // Boundary anchored to the maximal disks, shape lerped on top.
        const sides = buildSleeveSides(
            { edges: edgesA, knots: skeletonKnots(bzA),
              bz: m1.beziers, radii: m1.radii },
            { edges: edgesB, knots: skeletonKnots(bzB),
              bz: m2.beziers, radii: m2.radii },
            m1.us
        );

        entryLoc.set(fbA, { idx: entries.length, side: 'a' });
        entryLoc.set(fbB, { idx: entries.length, side: 'b' });

        bnds.push({
            a: boundaries(m1.beziers),
            b: boundaries(m2.beziers)
        });

        entries.push({
            a: m1.beziers,
            b: m2.beziers,
            ra: m1.radii,
            rb: m2.radii,
            us: m1.us,
            sleeveOut: sides.out,
            sleeveBack: sides.back,
            capSign,
            classes: `${matchColors[i % matchColors.length]} thin35 nofill`,
        });
    });

    const deletedSet = new Set(matchedTrees.deleted);
    const insertedSet = new Set(matchedTrees.inserted);

    // console.log(deletedSet.size);
    // console.log(insertedSet.size);

    // Deleted branches (shape 1 only): retract into their attachment as t→1.
    // placeTopology(tree1, deletedSet, 'a', 'red thin35 nofill', entryLoc, bnds, entries);

    // Inserted branches (shape 2 only): grow out of their attachment as t→0.
    // placeTopology(tree2, insertedSet, 'b', 'green thin35 nofill', entryLoc, bnds, entries);

    // Glue each matched non-trunk pair to its parents (per frame) so its
    // junction rides the parents' drawn skeletons throughout the morph.
    const parent1 = getParentMap(tree1);
    const parent2 = getParentMap(tree2);

    matchedTrees.pairs.forEach(([fbA, fbB], i) => {
        if (i === 0) { return; }  // the trunk pair is the root — nothing to glue to

        const idx = entryLoc.get(fbA)!.idx;
        const at1 = getAttachment(fbA, parent1, entryLoc, bnds, getLastP(entries[idx].a));
        const at2 = getAttachment(fbB, parent2, entryLoc, bnds, getLastP(entries[idx].b));
        if (at1 === undefined || at2 === undefined) { return; }

        entries[idx].glue = {
            e1: at1.e, k1: at1.k,
            e2: at2.e, k2: at2.k
        };
    });

    return entries as MorphEntry[];
}


/**
 * The entry index and boundary index a branch's junction attaches to: the
 * nearest boundary of its tree parent's entry (in the branch's own frame).
 */
function getAttachment(
        fb: FatBranch,
        parentMap: Map<FatBranch, FatBranch>,
        entryLoc: Map<FatBranch, EntryLoc>,
        bnds: { a?: number[][]; b?: number[][] }[],
        junction: number[]): { e: number; k: number } | undefined {

    const parent = parentMap.get(fb);
    if (parent === undefined) { return undefined; }

    const loc = entryLoc.get(parent);
    if (loc === undefined) { return undefined; }

    const bn = bnds[loc.idx][loc.side];
    if (bn === undefined) { return undefined; }

    return {
        e: loc.idx,
        k: nearestIdx(bn, junction)
    };
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]) {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


export { buildMorphEntries }
