import type { FatBranch } from './fat-branch/fat-branch.js';
import type { MorphEntry, MutableMorphEntry } from './morph-entry.js';
import type { AnchorPair } from './align-branches.js';
import { matchTrees } from './match-trees/match-trees.js';
import { alignBranches, resampleAt } from './align-branches.js';
import { buildSleeveSides, skeletonKnots } from './anchored-sleeves.js';
import { getLastP } from './fs/get-last-p.js';
import { getParentMap } from './get-parent-map.js';
import { getShapeArea } from 'flo-boolean';
import { length } from 'flo-bezier3';
import { clamp } from '../utils/clamp.js';
import { matchColors } from '../page/events/match-colors.js';
import { nearestIdx } from './nearest-idx.js';
import { placeTopology } from './place-topology.js';
import { composeThroughSkipped } from './compose-through-skipped.js';


type EntryLoc = { idx: number; side: 'a' | 'b' };

/** A matched feature (fork) position in both frames, for visualization. */
interface FeatureMark {
    readonly pA: number[];
    readonly pB: number[];
    readonly classes: string;
}

/**
 * Matches the two fat branch trees and builds the full set of morph entries:
 * resampled matched pairs plus collapsing deleted/inserted branches, all
 * glued so junctions stay attached throughout the morph.
 *
 * @param matchColorsList colors cycled through for the matched pairs
 */
function buildMorphEntries(
        tree1: FatBranch,
        tree2: FatBranch,
        marks?: FeatureMark[]): MorphEntry[] {

    const matchedTrees = matchTrees(tree1, tree2);

    // The sleeves walk the outline in its global direction - the trunk's
    // (mostly boundary) loop gives a reliable winding for the cap arcs.
    // Small child branches cannot: their closing sector arc is reversed and
    // can dominate, flipping their pss winding.
    const capSign = getShapeArea(tree1.pss) < 0 ? -1 : 1;

    const parent1 = getParentMap(tree1);
    const parent2 = getParentMap(tree2);
    const pairOf = new Map<FatBranch, FatBranch>(
        matchedTrees.pairs.map(p => [p[0], p[1]] as const));
    const pairIdxOf = new Map<FatBranch, number>(
        matchedTrees.pairs.map((p, i) => [p[0], i] as const));
    const unit1 = Math.sqrt(tree1.roundSalience);
    const unit2 = Math.sqrt(tree2.roundSalience);

    const deletedSet = new Set(matchedTrees.deleted);
    const insertedSet = new Set(matchedTrees.inserted);

    const entries: MutableMorphEntry[] = [];
    /** entry location of every fat branch */
    const entryLoc = new Map<FatBranch, EntryLoc>();
    /** per entry: its resampled segment boundary points, per side */
    const bnds: { a?: number[][]; b?: number[][] }[] = [];
    /** glue attachment per matched child, from the alignment's fork anchors */
    const anchorGlue = new Map<FatBranch, { e: number; k: number }>();
    /** matched ancestor of each composited (through-deleted) branch, per side */
    const mountsA = new Map<FatBranch, FatBranch>();
    const mountsB = new Map<FatBranch, FatBranch>();
    /** skipped branches partially absorbed by composites (min fork wins) */
    const trims = new Map<FatBranch, { fromEdge: number; absorber: FatBranch }>();

    // Matched pairs: feature-align for correspondence, morph shape1 → shape2.
    matchedTrees.pairs.forEach(([fbA, fbB], i) => {
        // A branch whose parent chain was deleted/inserted extends through
        // those ancestors to the nearest matched one - the partner's
        // trunk-adjacent material then has a real counterpart.
        const gA = composeThroughSkipped(fbA, parent1, deletedSet);
        const gB = composeThroughSkipped(fbB, parent2, insertedSet);
        if (gA.mount !== undefined) { mountsA.set(fbA, gA.mount); }
        if (gB.mount !== undefined) { mountsB.set(fbB, gB.mount); }
        for (const [g, fb] of [[gA, fbA], [gB, fbB]] as const) {
            for (const abs of g.absorbed) {
                const prev = trims.get(abs.branch);
                if (prev === undefined || abs.fromEdge < prev.fromEdge) {
                    trims.set(abs.branch,
                        { fromEdge: abs.fromEdge, absorber: fb });
                }
            }
        }

        const bzA = gA.bz;
        let bzB = gB.bz;
        const rdA = gA.rd;
        let rdB = gB.rd;

        // Boundary pieces per original skeleton edge, per side.
        const edgesA = gA.edges;
        let edgesB = gB.edges;

        // Flipped trunk: traverse tree2's trunk from its other tip - reverse
        // its skeleton; its edge sleeves reverse order and swap sides (the
        // boundary geometry itself keeps its outline direction).
        const flipped = i === 0 && matchedTrees.flipped;
        if (flipped) {
            bzB = bzB.map(ps => [...ps].reverse()).reverse();
            rdB = [...rdB].reverse();
            edgesB = [...edgesB].reverse()
                .map(e => ({ out: e.back, back: e.out }));
        }

        // Feature anchors: forks of this pair's MATCHED children.
        const LA = totalLen(bzA);
        const LB = totalLen(bzB);
        const anchors: AnchorPair[] = [];
        const anchorChildren: FatBranch[] = [];
        for (const edgeA of fbA.children ?? []) {
            const cA = edgeA.branch;
            const cB = pairOf.get(cA);
            if (cB === undefined || parent2.get(cB) !== fbB) { continue; }
            const edgeB = (fbB.children ?? []).find(e => e.branch === cB);
            if (edgeB === undefined) { continue; }

            const dB = edgeB.distanceFromLeaf;
            anchors.push({
                uA: clamp(edgeA.distanceFromLeaf / LA, 0, 1),
                uB: clamp((flipped ? LB - dB : dB) / LB, 0, 1)
            });
            anchorChildren.push(cA);
        }

        // Non-linear (feature-warped) correspondence along the skeleton.
        const al = alignBranches(bzA, rdA, bzB, rdB, anchors, unit1, unit2);
        const mA = resampleAt(bzA, rdA, al.usA);
        const mB = resampleAt(bzB, rdB, al.usB);

        // Boundary anchored to the maximal disks, shape lerped on top.
        const sides = buildSleeveSides(
            { edges: edgesA, knots: skeletonKnots(bzA),
              us: al.usA, bz: mA.beziers, radii: mA.radii },
            { edges: edgesB, knots: skeletonKnots(bzB),
              us: al.usB, bz: mB.beziers, radii: mB.radii }
        );

        entryLoc.set(fbA, { idx: entries.length, side: 'a' });
        entryLoc.set(fbB, { idx: entries.length, side: 'b' });

        const bndA = boundaries(mA.beziers);
        const bndB = boundaries(mB.beziers);
        bnds.push({ a: bndA, b: bndB });

        // Matched forks attach at the SAME breakpoint index in both frames.
        anchors.forEach((_, n) => {
            const k = al.anchorIdx[n];
            if (k < 0) { return; }
            anchorGlue.set(anchorChildren[n], { e: entries.length, k });
            if (marks !== undefined) {
                const ci = pairIdxOf.get(anchorChildren[n]) ?? 0;
                marks.push({
                    pA: bndA[k],
                    pB: bndB[k],
                    classes:
                        `${matchColors[ci % matchColors.length]} thin20 nofill`
                });
            }
        });

        entries.push({
            a: mA.beziers,
            b: mB.beziers,
            ra: mA.radii,
            rb: mB.radii,
            us: al.usA,
            sleeveOut: sides.out,
            sleeveBack: sides.back,
            capSign,
            classes: `${matchColors[i % matchColors.length]} thin35 nofill`,
        });
    });

    // Deleted branches (shape 1 only): retract into their attachment as t→1.
    placeTopology(tree1, deletedSet, 'a', 'red thin35 nofill', capSign,
        trims, entryLoc, bnds, entries);

    // Inserted branches (shape 2 only): grow out of their attachment as t→0.
    placeTopology(tree2, insertedSet, 'b', 'green thin35 nofill', capSign,
        trims, entryLoc, bnds, entries);

    // Glue each matched non-trunk pair to its parents (per frame) so its
    // junction rides the parents' drawn skeletons throughout the morph.
    matchedTrees.pairs.forEach(([fbA, fbB], i) => {
        if (i === 0) { return; }  // the trunk pair is the root — nothing to glue to

        const idx = entryLoc.get(fbA)!.idx;

        // Aligned fork anchor: same breakpoint index in both frames.
        const ag = anchorGlue.get(fbA);
        if (ag !== undefined) {
            entries[idx].glue = { e1: ag.e, k1: ag.k, e2: ag.e, k2: ag.k };
            return;
        }

        // Composited entries mount on their nearest matched ancestor.
        const mA = mountsA.get(fbA);
        const mB = mountsB.get(fbB);
        const at1 = mA !== undefined
            ? mountAttachment(mA, entryLoc, bnds, getLastP(entries[idx].a))
            : getAttachment(fbA, parent1, entryLoc, bnds, getLastP(entries[idx].a));
        const at2 = mB !== undefined
            ? mountAttachment(mB, entryLoc, bnds, getLastP(entries[idx].b))
            : getAttachment(fbB, parent2, entryLoc, bnds, getLastP(entries[idx].b));
        if (at1 === undefined || at2 === undefined) { return; }

        entries[idx].glue = {
            e1: at1.e, k1: at1.k,
            e2: at2.e, k2: at2.k
        };
    });

    return entries as MorphEntry[];
}


function totalLen(bz: number[][][]): number {
    return bz.reduce((s, ps) => s + length([0, 1], ps), 0);
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


/** Attachment on a composited branch's matched ancestor (its own frame). */
function mountAttachment(
        ancestor: FatBranch,
        entryLoc: Map<FatBranch, EntryLoc>,
        bnds: { a?: number[][]; b?: number[][] }[],
        junction: number[]): { e: number; k: number } | undefined {

    const loc = entryLoc.get(ancestor);
    if (loc === undefined) { return undefined; }

    const bn = bnds[loc.idx][loc.side];
    if (bn === undefined) { return undefined; }

    return { e: loc.idx, k: nearestIdx(bn, junction) };
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]) {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


export { buildMorphEntries }
export type { FeatureMark }
