import type { FatBranch } from './fat-branch/fat-branch.js';
import { getSkeletonBeziers, getSkeletonRadii } from './fat-branch/get-fat-branch-tree.js';
import { getEdgeSleeves } from './anchored-sleeves.js';
import { length } from 'flo-bezier3';


/** A branch's geometry, possibly extended through skipped ancestors. */
interface CompositeGeom {
    readonly bz: number[][][];
    readonly rd: number[];
    readonly edges: { out: number[][][]; back: number[][][] }[];
    /** the nearest non-skipped ancestor - set only if compositing occurred */
    readonly mount?: FatBranch;
    /** per absorbed ancestor: its edges from `fromEdge` on were taken */
    readonly absorbed: { branch: FatBranch; fromEdge: number }[];
}


/**
 * Extends a matched branch's geometry through its chain of skipped
 * (deleted/inserted) ancestors up to the nearest matched ancestor: the
 * composite path runs from the branch's tip through each ancestor's stretch
 * between the attachment fork and that ancestor's junction. Skeleton, radii
 * and per-edge sleeves concatenate directly (the absorbed stretch is walked
 * in the ancestor's own direction, so its out/back sides carry over; contact
 * discontinuities at the turns become ordinary fork gaps downstream).
 *
 * Without skipped ancestors the branch's own geometry is returned unchanged
 * (`mount` undefined).
 */
function composeThroughSkipped(
        fb: FatBranch,
        parentMap: Map<FatBranch, FatBranch>,
        skipSet: Set<FatBranch>): CompositeGeom {

    let bz = getSkeletonBeziers(fb);
    let rd = getSkeletonRadii(fb);
    let edges = getEdgeSleeves(fb);
    const absorbed: { branch: FatBranch; fromEdge: number }[] = [];

    let cur = fb;
    let p = parentMap.get(fb);
    let composited = false;

    while (p !== undefined && skipSet.has(p)) {
        const edge = (p.children ?? []).find(e => e.branch === cur);
        if (edge === undefined) { break; }

        const pBz = getSkeletonBeziers(p);
        const j = edgeIndexAt(pBz, edge.distanceFromLeaf);

        bz = [...bz, ...pBz.slice(j)];
        rd = [...rd, ...getSkeletonRadii(p).slice(j + 1)];
        edges = [...edges, ...getEdgeSleeves(p).slice(j)];
        absorbed.push({ branch: p, fromEdge: j });

        composited = true;
        cur = p;
        p = parentMap.get(p);
    }

    if (!composited || p === undefined) {
        // No skipped ancestors, or the chain never reached a matched
        // ancestor - keep the branch's own geometry.
        return composited
            ? { bz: getSkeletonBeziers(fb), rd: getSkeletonRadii(fb),
                edges: getEdgeSleeves(fb), absorbed: [] }
            : { bz, rd, edges, absorbed: [] };
    }

    return { bz, rd, edges, mount: p, absorbed };
}


/** Index of the parent's skeleton knot (= slice start) nearest arc `d`. */
function edgeIndexAt(bz: number[][][], d: number): number {
    let cum = 0;
    let best = 0;
    let bestDiff = Math.abs(d);
    for (let j = 1; j <= bz.length; j++) {
        cum += length([0, 1], bz[j - 1]);
        const diff = Math.abs(cum - d);
        if (diff < bestDiff) { bestDiff = diff; best = j; }
    }
    return best;
}


export { composeThroughSkipped }
export type { CompositeGeom }
