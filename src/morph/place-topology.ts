import type { FatBranch } from './fat-branch/fat-branch.js';
import type { Glue, MutableMorphEntry } from './morph-entry.js';
import type { Segment } from './segment-graph/segment.js';
import { composeSegs } from './segment-graph/compose-segs.js';
import { buildSleeveSides, skeletonKnots } from './anchored-sleeves.js';
import { getLastP } from './fs/get-last-p.js';
import { nearestIdx } from './nearest-idx.js';


/**
 * Which entry a fat branch (slice) lives in, and on which side ('a' =
 * shape 1). A branch can be covered by SEVERAL entries (e.g. a
 * fork-terminated trunk covers its middle, a matched terminal pair its
 * tip) - consumers keep one list per branch and pick by boundary distance.
 */
type EntryLoc = {
    idx: number;
    side: 'a' | 'b'
}


/**
 * A skipped branch's absorbed remainder: only `keep` (its tip-side
 * segments) still retracts; the rest lives in the matched `absorber`'s
 * composite entry.
 */
type Trim = {
    keep: Segment[]; absorber: FatBranch
}


/**
 * Places an entry for each unmatched branch, ancestors first: it collapses
 * onto its own junction (skeleton, radii and boundary sleeves all
 * degenerate to that point in the other frame) while its glue keeps the
 * junction riding the parent's drawn skeleton throughout the morph. Chained
 * unmatched branches glue to the (already placed) unmatched parent's entry
 * the same way. A branch whose junction-side stretch was absorbed by a
 * composited matched descendant is TRIMMED to its unmatched remainder and
 * retracts into the absorption fork on the absorber's entry instead.
 * `side` is the tree's own frame ('a' = shape 1 for deleted, 'b' = shape 2
 * for inserted).
 */
function placeTopology(
        /** child branch → parent (the segment graph's tree relations) */
        parentOf: Map<FatBranch, FatBranch>,
        /** every branch's graph segments, tip → junction */
        segsOf: Map<FatBranch, Segment[]>,
        topoSet: Set<FatBranch>,
        side: 'a' | 'b',
        classes: string,
        capSign: number,
        trims: Map<FatBranch, Trim>,
        entryLoc: Map<FatBranch, EntryLoc[]>,
        bnds: { a?: number[][]; b?: number[][] }[],
        entries: MutableMorphEntry[],
        /** bypassed trunk-stub entries per host branch: glue candidates for
         *  children hanging off the bypassed stretch */
        stubEntries: Map<FatBranch, number[]> = new Map(),
        /** attachment-point dot marks (own frame) */
        marks?: { pA?: number[]; pB?: number[]; classes: string;
            dot?: boolean;
            at?: { e: number; k1: number; k2: number } }[]): void {

    // Ancestors before descendants: chained unmatched children glue to
    // their already-placed parent's entry.
    const depthOf = (br: FatBranch): number => {
        let d = 0;
        for (let p = parentOf.get(br); p !== undefined;
            p = parentOf.get(p)) { d++; }
        return d;
    };
    for (const child of [...topoSet].sort(
            (x, y) => depthOf(x) - depthOf(y))) {
        const parent = parentOf.get(child);
        if (parent !== undefined) { place(parent, child); }
    }

    function place(parent: FatBranch, child: FatBranch): void {
        // Absorbed junction-side stretch: keep only the tip-side remainder
        // and retract it into the absorption fork on the absorber's entry.
        let glueTo = parent;
        let segs = segsOf.get(child) ?? [];
        const trim = trims.get(child);
        if (trim !== undefined) {
            segs = trim.keep;
            glueTo = trim.absorber;
        }
        if (segs.length === 0) { return; }

        const { bz, rd: radii, edges } = composeSegs(segs);

        const junction = getLastP(bz);  // fork center / absorption fork

        // A chained child's fork may lie on its parent's ABSORBED stretch -
        // then the absorber's composite owns that boundary, not the trimmed
        // remainder. Pick whichever candidate's boundary the junction is
        // actually on (the true one matches exactly). Children of the ROOT
        // may also sit on a bypassed trunk stub.
        const candidateEs: number[] = [];
        const candBranches: FatBranch[] = [glueTo];
        const pTrim = trims.get(parent);
        if (glueTo === parent && pTrim !== undefined) {
            candBranches.push(pTrim.absorber);
        }
        for (const cand of candBranches) {
            for (const loc of entryLoc.get(cand) ?? []) {
                candidateEs.push(loc.idx);
            }
            candidateEs.push(...(stubEntries.get(cand) ?? []));
        }

        let bestAt: { e: number; k: number } | undefined;
        let bestD = Infinity;
        for (const e of candidateEs) {
            const bn = bnds[e][side];
            if (bn === undefined) { continue; }
            const k = nearestIdx(bn, junction);
            const d = Math.hypot(
                bn[k][0] - junction[0], bn[k][1] - junction[1]);
            if (d < bestD) { bestD = d; bestAt = { e, k }; }
        }
        if (bestAt === undefined) { return; }

        const glue: Glue = {
            e1: bestAt.e, k1: bestAt.k,
            e2: bestAt.e, k2: bestAt.k
        };

        const bnAt = bnds[bestAt.e][side]![bestAt.k];
        marks?.push({
            [side === 'a' ? 'pA' : 'pB']: bnAt,
            classes: `${side === 'a' ? 'red' : 'green'} nostroke`,
            dot: true,
            at: { e: bestAt.e, k1: bestAt.k, k2: bestAt.k }
        });

        entryLoc.set(child, [{
            idx: pushCollapsedEntry(
                bz, radii, edges, side, classes, capSign, glue,
                bnds, entries),
            side
        }]);
    }
}


/**
 * Pushes a topology entry: the real geometry in its own frame, collapsed
 * onto its junction (last point) with zero radii and point sleeves in the
 * other frame. Returns the entry index.
 */
function pushCollapsedEntry(
        bz: number[][][],
        radii: number[],
        edges: { out: number[][][]; back: number[][][] }[],
        side: 'a' | 'b',
        classes: string,
        capSign: number,
        glue: Glue,
        bnds: { a?: number[][]; b?: number[][] }[],
        entries: MutableMorphEntry[]): number {

    const junction = getLastP(bz);

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

    const idx = entries.length;
    bnds.push(side === 'a' ? { a: boundaries(bz) } : { b: boundaries(bz) });
    entries.push({
        skelPssA: side === 'a' ? bz : collapsed,
        skelPssB: side === 'a' ? collapsed : bz,
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

    return idx;
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]): number[][] {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


function collapseTo(beziers: number[][][], pt: number[]): number[][][] {
    return beziers.map(ps => ps.map(() => [pt[0], pt[1]]));
}


export type { EntryLoc, Trim }
export { placeTopology, pushCollapsedEntry }
