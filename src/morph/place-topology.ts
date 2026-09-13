import type { FatBranch } from './fat-branch/fat-branch.js';
import type { Glue, MutableMorphEntry } from './morph-entry.js';
import { getSkeletonBeziers, getSkeletonRadii } from './fat-branch/get-fat-branch-tree.js';
import { buildSleeveSides, getEdgeSleeves, skeletonKnots } from './anchored-sleeves.js';
import { getLastP } from './fs/get-last-p.js';
import { nearestIdx } from './nearest-idx.js';


/** Which entry a fat branch lives in, and on which side ('a' = shape 1). */
type EntryLoc = { idx: number; side: 'a' | 'b' };

/** A skipped branch's absorbed stretch: edges from `fromEdge` on now live
 *  in the matched `absorber`'s composite entry. */
type Trim = { fromEdge: number; absorber: FatBranch };


/**
 * Walk a tree parents-first, adding an entry for each unmatched branch:
 * it collapses onto its own junction (skeleton, radii and boundary sleeves
 * all degenerate to that point in the other frame) while its glue keeps the
 * junction riding the parent's drawn skeleton throughout the morph. Chained
 * unmatched branches glue to the (already placed) unmatched parent's entry
 * the same way. A branch whose junction-side stretch was absorbed by a
 * composited matched descendant is TRIMMED to its unmatched remainder and
 * retracts into the absorption fork on the absorber's entry instead.
 * `side` is the tree's own frame ('a' = shape 1 for deleted, 'b' = shape 2
 * for inserted).
 */
function placeTopology(
        root: FatBranch,
        topoSet: Set<FatBranch>,
        side: 'a' | 'b',
        classes: string,
        capSign: number,
        trims: Map<FatBranch, Trim>,
        entryLoc: Map<FatBranch, EntryLoc>,
        bnds: { a?: number[][]; b?: number[][] }[],
        entries: MutableMorphEntry[]): void {

    walk(root);

    function walk(parent: FatBranch): void {
        for (const edge of parent.children ?? []) {
            const child = edge.branch;

            if (topoSet.has(child)) { place(parent, child); }

            walk(child);
        }
    }

    function place(parent: FatBranch, child: FatBranch): void {
        let bz = getSkeletonBeziers(child);
        let radii = getSkeletonRadii(child);
        let edges = getEdgeSleeves(child);

        // Absorbed junction-side stretch: keep only the tip-side remainder
        // and retract it into the absorption fork on the absorber's entry.
        let glueTo = parent;
        const trim = trims.get(child);
        if (trim !== undefined && trim.fromEdge >= 1) {
            bz = bz.slice(0, trim.fromEdge);
            radii = radii.slice(0, trim.fromEdge + 1);
            edges = edges.slice(0, trim.fromEdge);
            glueTo = trim.absorber;
        }
        if (bz.length === 0) { return; }

        const junction = getLastP(bz);  // fork center / absorption fork

        // A chained child's fork may lie on its parent's ABSORBED stretch -
        // then the absorber's composite owns that boundary, not the trimmed
        // remainder. Pick whichever candidate's boundary the junction is
        // actually on (the true one matches exactly).
        const candidates: FatBranch[] = [glueTo];
        const pTrim = trims.get(parent);
        if (glueTo === parent && pTrim !== undefined) {
            candidates.push(pTrim.absorber);
        }

        let bestAt: { e: number; k: number } | undefined;
        let bestD = Infinity;
        for (const cand of candidates) {
            const loc = entryLoc.get(cand);
            if (loc === undefined) { continue; }
            const bn = bnds[loc.idx][loc.side];
            if (bn === undefined) { continue; }
            const k = nearestIdx(bn, junction);
            const d = Math.hypot(
                bn[k][0] - junction[0], bn[k][1] - junction[1]);
            if (d < bestD) { bestD = d; bestAt = { e: loc.idx, k }; }
        }
        if (bestAt === undefined) { return; }

        const glue: Glue = {
            e1: bestAt.e, k1: bestAt.k,
            e2: bestAt.e, k2: bestAt.k
        };

        const collapsed = collapseTo(bz, junction);
        // Radii → 0 so the branch's disks vanish into the fork disk
        // (pinning them to the fork radius made tip disks GROW).
        const rZero = radii.map(() => 0);

        // No resampling needed: the collapsed frame mirrors the real frame
        // segment for segment, so both use the real frame's knots.
        const us = skeletonKnots(bz);
        const pointEdges = edges.map(() => ({
            out: [[junction, junction]],
            back: [[junction, junction]]
        }));

        const real = { edges, knots: us, us, bz, radii };
        const gone = {
            edges: pointEdges, knots: us, us, bz: collapsed, radii: rZero
        };

        const sides = side === 'a'
            ? buildSleeveSides(real, gone)
            : buildSleeveSides(gone, real);

        entryLoc.set(child, { idx: entries.length, side });
        bnds.push(side === 'a' ? { a: boundaries(bz) } : { b: boundaries(bz) });
        entries.push({
            a: side === 'a' ? bz : collapsed,
            b: side === 'a' ? collapsed : bz,
            ra: side === 'a' ? radii : rZero,
            rb: side === 'a' ? rZero : radii,
            us,
            sleeveOut: sides.out,
            sleeveBack: sides.back,
            capSign,
            classes,
            glue,
            collapsed: side === 'a' ? 'b' : 'a'
        });
    }
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]): number[][] {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


function collapseTo(beziers: number[][][], pt: number[]): number[][][] {
    return beziers.map(ps => ps.map(() => [pt[0], pt[1]]));
}


export type { EntryLoc, Trim }
export { placeTopology }
