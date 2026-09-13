import type { FatBranch } from './fat-branch/fat-branch.js';
import type { MorphEntry, MutableMorphEntry } from './morph-entry.js';
import type { AnchorPair } from './align-branches.js';
import type { MatchedPath, PathNode } from './match-paths/match-paths.js';
import type { EntryLoc, Trim } from './place-topology.js';
import { matchPaths } from './match-paths/match-paths.js';
import { alignBranches, resampleAt } from './align-branches.js';
import {
    buildSleeveSides, skeletonKnots, getEdgeSleeves
} from './anchored-sleeves.js';
import {
    getSkeletonBeziers, getSkeletonRadii
} from './fat-branch/get-fat-branch-tree.js';
import { edgeIndexAt } from './edge-index-at.js';
import { getLastP } from './fs/get-last-p.js';
import { getShapeArea } from 'flo-boolean';
import { length } from 'flo-bezier3';
import { clamp } from '../utils/clamp.js';
import { matchColors } from '../page/events/match-colors.js';
import { nearestIdx } from './nearest-idx.js';
import { placeTopology } from './place-topology.js';


/** A matched feature (fork) position in both frames, for visualization. */
interface FeatureMark {
    readonly pA: number[];
    readonly pB: number[];
    readonly classes: string;
}


/**
 * Matches the two fat branch trees PATH-wise (junction-to-leaf chains, DTW
 * alignability as the matching metric) and builds the full set of morph
 * entries: each matched path pair becomes one feature-aligned entry (a
 * chain's composite geometry is native - no post-hoc compositing), matched
 * child forks along the whole path are alignment anchors and glue points,
 * and everything unmatched (whole subtrees, off-path leaf-side stubs)
 * collapses via topology entries glued to the entry owning its fork.
 */
function buildMorphEntries(
        tree1: FatBranch,
        tree2: FatBranch,
        marks?: FeatureMark[]): MorphEntry[] {

    const pm = matchPaths(tree1, tree2);

    // The sleeves walk the outline in its global direction - the trunk's
    // (mostly boundary) loop gives a reliable winding for the cap arcs.
    const capSign = getShapeArea(tree1.pss) < 0 ? -1 : 1;

    const unit1 = Math.sqrt(tree1.roundSalience);
    const unit2 = Math.sqrt(tree2.roundSalience);

    const entries: MutableMorphEntry[] = [];
    /** entry location of every fat branch */
    const entryLoc = new Map<FatBranch, EntryLoc>();
    /** per entry: its resampled segment boundary points, per side */
    const bnds: { a?: number[][]; b?: number[][] }[] = [];
    /** branches fully covered by a matched path (per tree) */
    const onPath1 = new Set<FatBranch>();
    const onPath2 = new Set<FatBranch>();
    /** stub hosts: their leaf-side remainder retracts (per tree) */
    const trims1 = new Map<FatBranch, Trim>();
    const trims2 = new Map<FatBranch, Trim>();

    let pairIdx = 0;

    buildPair(pm.trunk, true);

    // Whatever no matched path covers collapses: whole unmatched subtrees
    // in full, stub hosts trimmed to their leaf-side remainders.
    placeTopology(tree1, topoSetOf(tree1, onPath1, trims1), 'a',
        'red thin35 nofill', capSign, trims1, entryLoc, bnds, entries);
    placeTopology(tree2, topoSetOf(tree2, onPath2, trims2), 'b',
        'green thin35 nofill', capSign, trims2, entryLoc, bnds, entries);

    return entries as MorphEntry[];


    /** Builds the entry for one matched path pair, then recursively its
     *  matched children's entries (glued onto this one). Returns the index. */
    function buildPair(mp: MatchedPath, isTrunk: boolean): number {
        const i = pairIdx++;
        const idx = entries.length;

        const gA = composeChain(mp.a);
        const gB = composeChain(mp.b);
        let bzB = gB.bz;
        let rdB = gB.rd;
        let edgesB = gB.edges;

        // Flipped trunk: traverse tree2's trunk from its other tip - reverse
        // its skeleton; its edge sleeves reverse order and swap sides (the
        // boundary geometry itself keeps its outline direction). The
        // matcher's pooled distances already use the flipped convention.
        if (isTrunk && pm.flipped) {
            bzB = bzB.map(ps => [...ps].reverse()).reverse();
            rdB = [...rdB].reverse();
            edgesB = [...edgesB].reverse()
                .map(e => ({ out: e.back, back: e.out }));
        }

        registerChain(mp.a, 'a', idx, onPath1, trims1);
        registerChain(mp.b, 'b', idx, onPath2, trims2);

        // Feature anchors: ALL matched child forks along the paths (incl.
        // absorbed stretches - the matcher pooled them).
        const LA = totalLen(gA.bz);
        const LB = totalLen(bzB);
        const matchOps = mp.children.filter(
            op => op.type === 'match');
        const anchors: AnchorPair[] = matchOps.map(op => ({
            uA: clamp(op.a.dist / LA, 0, 1),
            uB: clamp(op.b.dist / LB, 0, 1)
        }));

        // Non-linear (feature-warped) correspondence along the skeleton.
        const al = alignBranches(gA.bz, gA.rd, bzB, rdB, anchors,
            unit1, unit2);
        const mA = resampleAt(gA.bz, gA.rd, al.usA);
        const mB = resampleAt(bzB, rdB, al.usB);

        // Boundary anchored to the maximal disks, shape lerped on top.
        const sides = buildSleeveSides(
            { edges: gA.edges, knots: skeletonKnots(gA.bz),
              us: al.usA, bz: mA.beziers, radii: mA.radii },
            { edges: edgesB, knots: skeletonKnots(bzB),
              us: al.usB, bz: mB.beziers, radii: mB.radii }
        );

        const bndA = boundaries(mA.beziers);
        const bndB = boundaries(mB.beziers);
        bnds.push({ a: bndA, b: bndB });

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

        // Children: build each matched sub-pair and glue it to this entry -
        // at the aligned fork anchor when kept, else at the per-frame
        // nearest boundary.
        matchOps.forEach((op, n) => {
            const childIdx = buildPair(op.sub, false);

            const k = al.anchorIdx[n];
            entries[childIdx].glue = k >= 0
                ? { e1: idx, k1: k, e2: idx, k2: k }
                : {
                    e1: idx,
                    k1: nearestIdx(bndA, getLastP(entries[childIdx].a)),
                    e2: idx,
                    k2: nearestIdx(bndB, getLastP(entries[childIdx].b))
                };

            if (marks !== undefined && k >= 0) {
                marks.push({
                    pA: bndA[k],
                    pB: bndB[k],
                    classes: `${matchColors[
                        (childIdx) % matchColors.length]} thin20 nofill`
                });
            }
        });

        return idx;
    }

    /** Registers a chain's branches: entry location for all, fully-covered
     *  ones as on-path, stub hosts with their trim. */
    function registerChain(
            nodes: PathNode[],
            side: 'a' | 'b',
            idx: number,
            onPath: Set<FatBranch>,
            trims: Map<FatBranch, Trim>): void {

        const leaf = nodes[nodes.length - 1].branch;
        for (const node of nodes) {
            entryLoc.set(node.branch, { idx, side });
            if (node.exit === undefined) {
                onPath.add(node.branch);
                continue;
            }
            const j = edgeIndexAt(
                getSkeletonBeziers(node.branch),
                node.exit.distanceFromLeaf);
            if (j >= 1) {
                trims.set(node.branch, { fromEdge: j, absorber: leaf });
            } else {
                onPath.add(node.branch);  // empty stub - fully absorbed
            }
        }
    }
}


/** A chain's composite geometry: skeleton, radii and per-edge sleeves,
 *  leaf → junction (each branch traversed in its own direction). */
function composeChain(nodes: PathNode[]): {
        bz: number[][][];
        rd: number[];
        edges: { out: number[][][]; back: number[][][] }[] } {

    const leaf = nodes[nodes.length - 1].branch;
    let bz = getSkeletonBeziers(leaf);
    let rd = getSkeletonRadii(leaf);
    let edges = getEdgeSleeves(leaf);

    for (let k = nodes.length - 2; k >= 0; k--) {
        const { branch, exit } = nodes[k];
        const pBz = getSkeletonBeziers(branch);
        const j = edgeIndexAt(pBz, exit!.distanceFromLeaf);

        bz = [...bz, ...pBz.slice(j)];
        rd = [...rd, ...getSkeletonRadii(branch).slice(j + 1)];
        edges = [...edges, ...getEdgeSleeves(branch).slice(j)];
    }

    return { bz, rd, edges };
}


/** All branches of the tree not fully covered by a matched path (stub hosts
 *  keep their trim: only the leaf-side remainder collapses). */
function topoSetOf(
        root: FatBranch,
        onPath: Set<FatBranch>,
        trims: Map<FatBranch, Trim>): Set<FatBranch> {

    const out = new Set<FatBranch>();
    const walk = (br: FatBranch): void => {
        if (!onPath.has(br)) { out.add(br); }
        for (const e of br.children ?? []) { walk(e.branch); }
    };
    walk(root);

    // A trim without a topo placement would be ignored; a topo stub host
    // without its trim would collapse in full - keep them consistent.
    for (const host of trims.keys()) { out.add(host); }
    out.delete(root);

    return out;
}


function totalLen(bz: number[][][]): number {
    return bz.reduce((s, ps) => s + length([0, 1], ps), 0);
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]) {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


export { buildMorphEntries }
export type { FeatureMark }
