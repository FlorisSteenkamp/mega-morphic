declare var _debug_: Debug; 
import type { Debug } from '../../debug/debug.js';
import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { MorphEntry, MutableMorphEntry } from '../morph-entry.js';
import type { AnchorPair } from '../align-branches.js';
import type { MatchedPath } from '../match-paths/matched-path.js';
import type { PathPiece } from '../match-paths/path-piece.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { EntryLoc, Trim } from '../place-topology.js';
import type { PoseRamp } from '../pose-ramp.js';
import { getShapeArea } from 'flo-boolean';
import { matchPaths } from '../match-paths/match-paths.js';
import { procrustes } from '../procrustes/procrustes-analysis.js';
import { resolveMorphAt } from '../resolve-morph-at.js';
import { alignBranches, resampleAt } from '../align-branches.js';
import { buildSleeveSides, skeletonKnots, getEdgeSleeves } from '../anchored-sleeves.js';
import { getSkeletonBeziers } from '../fat-branch/get-fat-branch-tree.js';
import { getLastP } from '../fs/get-last-p.js';
import { clamp } from '../../utils/clamp.js';
import { matchColors } from '../../page/events/match-colors.js';
import { nearestIdx } from '../nearest-idx.js';
import { placeTopology, pushCollapsedEntry } from '../place-topology.js';
import { getPolyBezierLength } from '../fs/get-poly-bezier-length.js';
import { getSkeletonRadii } from '../fat-branch/get-skeleton-radii.js';

const { sqrt, sin, cos, round, PI: π } = Math;


/**
 * A matched feature (fork) position in both frames, for visualization.
 * 
 * * Crosses = aligned fork anchors;
 * * dots = plain attachment points (fallback-glued matched children, topo/stub retraction targets)
 */
interface FeatureMark {
    readonly pA?: number[];
    readonly pB?: number[];
    readonly classes: string;
    readonly dot?: boolean;
    /** the mark's home on the DRAWN entries: boundary indices k1 (t=0) to
     *  k2 (t=1) of entry `e` - lets the mark ride the morph */
    readonly at?: { e: number; k1: number; k2: number };
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
        marks: FeatureMark[],
        weights?: Partial<PathCostWeights>,
        /** pass to enable procrustes pose alignment: shape 2's frame is
         *  aligned onto shape 1 for the morph, and the returned `ramp`
         *  restores its true pose over t (apply when drawing) */
        poseOut?: { ramp?: PoseRamp }): MorphEntry[] {

    const pm = matchPaths(tree1, tree2, { weights });

    if (typeof _debug_ !== 'undefined') {
        // Keep only the LATEST result - readers use [0]/at(-1) and stale
        // entries (whole trees) would otherwise accumulate.
        _debug_.elems.pathMatchResult.length = 0;
        _debug_.elems.matchTrees.length = 0;
        _debug_.elems.pathMatchResult.push(pm);
        _debug_.elems.matchTrees.push({ tree1, tree2 });
    }

    // The sleeves walk the outline in its global direction - the trunk's
    // (mostly boundary) loop gives a reliable winding for the cap arcs.
    const capSign = getShapeArea(tree1.pss) < 0 ? -1 : 1;

    const unit1 = sqrt(tree1.roundSalience);
    const unit2 = sqrt(tree2.roundSalience);

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
    /**
     * bypassed trunk-stub entries, per side (glue candidates for root
     *  children in placeTopology)
     */
    const rootStubs1: number[] = [];
    const rootStubs2: number[] = [];

    buildPair(pm.trunk, true);

    // Whatever no matched path covers collapses: whole unmatched subtrees
    // in full, stub hosts trimmed to their leaf-side remainders.
    placeTopology(tree1, topoSetOf(tree1, onPath1, trims1), 'a',
        'red thin35 nofill', capSign, trims1, entryLoc, bnds, entries,
        rootStubs1, marks);
    placeTopology(tree2, topoSetOf(tree2, onPath2, trims2), 'b',
        'green thin35 nofill', capSign, trims2, entryLoc, bnds, entries,
        rootStubs2, marks);

    if (poseOut !== undefined) {
        poseOut.ramp = applyProcrustes(tree1, tree2, entries);
    }

    return entries as MorphEntry[];


    /**
     * Builds the entry for one matched path pair, then recursively its
     * matched children's entries (glued onto this one). Returns the index.
     */
    function buildPair(
            mp: MatchedPath,
            isTrunk: boolean): number {

        const i = pairIdx++;
        const idx = entries.length;

        const gA = composePieces(mp.piecesA);
        const gB = composePieces(mp.piecesB);

        registerPieces(entryLoc, mp.piecesA, 'a', idx, tree1, onPath1, trims1);
        registerPieces(entryLoc, mp.piecesB, 'b', idx, tree2, onPath2, trims2);

        // Feature anchors: ALL matched child forks along the paths (incl.
        // absorbed stretches - the matcher pooled them).
        const LA = getPolyBezierLength(gA.bz);
        const LB = getPolyBezierLength(gB.bz);

        const matchOps = mp.children.filter(
            op => op.type === 'match');
        const anchors: AnchorPair[] = matchOps.map(op => ({
            uA: clamp(op.a.dist / LA, 0, 1),
            uB: clamp(op.b.dist / LB, 0, 1)
        }));

        // Non-linear (feature-warped) correspondence along the skeleton.
        const al = alignBranches(
            gA.bz, gA.rd, gB.bz, gB.rd, anchors, unit1, unit2
        );

        const mA = resampleAt(gA.bz, gA.rd, al.usA);
        const mB = resampleAt(gB.bz, gB.rd, al.usB);

        // Boundary anchored to the maximal disks, shape lerped on top.
        const sides = buildSleeveSides(
            { edges: gA.edges, knots: skeletonKnots(gA.bz),
              us: al.usA, bz: mA.beziers, radii: mA.radii },
            { edges: gB.edges, knots: skeletonKnots(gB.bz),
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

        // Bypassed trunk tip stretches retract into the trunk composite.
        if (isTrunk) {
            pushTrunkStubs(capSign, entries, bnds, marks, mp.piecesA, 'a', tree1, idx, bndA,
                'red thin35 nofill', rootStubs1);
            pushTrunkStubs(capSign, entries, bnds, marks, mp.piecesB, 'b', tree2, idx, bndB,
                'green thin35 nofill', rootStubs2);
        }

        // Children: build each matched sub-pair and glue it to this entry -
        // at the aligned fork anchor when kept, else at the per-frame
        // nearest boundary.
        matchOps.forEach((op, n) => {
            const childIdx = buildPair(op.sub, false);

            const k = al.anchorIdx[n];
            if (k >= 0) {
                entries[childIdx].glue = { e1: idx, k1: k, e2: idx, k2: k };
                if (marks !== undefined) {
                    marks.push({
                        pA: bndA[k],
                        pB: bndB[k],
                        classes: `${matchColors[
                            childIdx % matchColors.length]} thin20 nofill`,
                        at: { e: idx, k1: k, k2: k }
                    });
                }
            } else {
                const k1 = nearestIdx(bndA, getLastP(entries[childIdx].a));
                const k2 = nearestIdx(bndB, getLastP(entries[childIdx].b));
                entries[childIdx].glue = { e1: idx, k1, e2: idx, k2 };
                marks?.push({
                    pA: bndA[k1],
                    pB: bndB[k2],
                    classes: 'gray nostroke',
                    dot: true,
                    at: { e: idx, k1, k2 }
                });
            }
        });

        return idx;
    }
}


/** Registers a path's branches: entry location for all, fully-covered
 *  ones as on-path, partially-covered hosts with their trim. */
function registerPieces(
        entryLoc: Map<FatBranch, EntryLoc>,
        pieces: PathPiece[],
        side: 'a' | 'b',
        idx: number,
        root: FatBranch,
        onPath: Set<FatBranch>,
        trims: Map<FatBranch, Trim>): void {

    // The absorber must stay mapped to THIS entry (full pieces are
    // never re-mapped by placeTopology).
    const absorber = pieces.find(p => isFull(p))!.branch;

    for (const p of pieces) {
        entryLoc.set(p.branch, { idx, side });
        if (isFull(p) || p.branch === root || p.fromEdge === 0) {
            // Full, the trunk (stubs handled separately), or an empty
            // stub - nothing left to retract via placeTopology.
            onPath.add(p.branch);
        } else {
            trims.set(p.branch, { fromEdge: p.fromEdge, absorber });
        }
    }
}


/** Collapse entries for a trunk piece's bypassed tip stretches: the
 *  start stub in its own orientation, the end stub reversed - both
 *  ending at their fork knot, glued onto the trunk pair's entry. */
function pushTrunkStubs(
        capSign: number,
        entries: MutableMorphEntry[],
        bnds: { a?: number[][]; b?: number[][] }[],
        marks: FeatureMark[],
        pieces: PathPiece[],
        side: 'a' | 'b',
        root: FatBranch,
        pairIdx_: number,
        bnd: number[][],
        classes: string,
        outList: number[]): void {

    const p = pieces.find(q => q.branch === root);
    if (p === undefined) { return; }

    const len = getSkeletonBeziers(root).length;
    const stubs: { from: number; to: number; reversed: boolean }[] = [];
    if (p.fromEdge > 0) {
        stubs.push({ from: 0, to: p.fromEdge, reversed: false });
    }
    if (p.toEdge < len) {
        stubs.push({ from: p.toEdge, to: len, reversed: true });
    }

    for (const s of stubs) {
        const g = sliceGeom(root, s.from, s.to, s.reversed);
        const junction = getLastP(g.bz);
        const k = nearestIdx(bnd, junction);
        outList.push(pushCollapsedEntry(
            g.bz, g.rd, g.edges, side, classes, capSign,
            { e1: pairIdx_, k1: k, e2: pairIdx_, k2: k },
            bnds, entries));
        marks?.push({
            [side === 'a' ? 'pA' : 'pB']: bnd[k],
            classes: `${side === 'a' ? 'red' : 'green'} nostroke`,
            dot: true,
            at: { e: pairIdx_, k1: k, k2: k }
        });
    }
}

/** Whether a piece covers its whole branch. */
function isFull(p: PathPiece): boolean {
    return p.fromEdge === 0 &&
        p.toEdge === getSkeletonBeziers(p.branch).length;
}


/**
 * Aligns shape 2's frame onto shape 1 (smallest principal-axis rotation,
 * √area scale, centroid-to-centroid) by mapping every b-frame coordinate of
 * the built entries into the aligned frame - the sleeve data is stored in
 * local frames (chord-normalized pieces, polar anchors) and radii are
 * scaled, so the reconstruction stays exact. Static marks are NOT touched
 * (svg2 shows the original shape). Returns the ramp restoring the true pose.
 */
function applyProcrustes(
        tree1: FatBranch,
        tree2: FatBranch,
        entries: MutableMorphEntry[]): PoseRamp {

    const pose1 = procrustes(tree1.pss);
    const pose2 = procrustes(tree2.pss);

    const s = pose1.scale / pose2.scale;
    // Principal axes are only defined mod π - take the smaller rotation.
    const θ = wrapModPi(pose1.angle - pose2.angle);

    const cosθ = cos(θ);
    const sinθ = sin(θ);
    const [c2x, c2y] = pose2.centroid;
    const [c1x, c1y] = pose1.centroid;
    const tf = ([x, y]: number[]): number[] => {
        const ux = x - c2x;
        const uy = y - c2y;
        return [
            c1x + s*(cosθ*ux - sinθ*uy),
            c1y + s*(sinθ*ux + cosθ*uy)
        ];
    };

    for (const e of entries) {
        // Deleted (side-a) topo entries live entirely in shape 1's frame.
        if (e.collapsed === 'b') { continue; }
        // An inserted entry's collapsed frame is in shape 2's coords too.
        if (e.collapsed === 'a') { e.a = e.a.map(ps => ps.map(tf)); }
        e.b = e.b.map(ps => ps.map(tf));
        if (e.rb !== undefined) { e.rb = e.rb.map(r => r * s); }
    }

    // Measured axis angles of the aligned-frame morph, sampled over t and
    // UNWRAPPED (period π). Branch decisions are chained ONLY through
    // samples whose axis is measurable (near isotropy the angle is pure
    // noise and nearest-branch chaining random-walks by ±π/2 hops -
    // accumulating spurious full turns); unmeasurable stretches are filled
    // by interpolation between confident neighbors.
    const N = 32;
    const MIN_ANISO = 0.05;
    const angles: number[] = [];
    const anisos: number[] = [];
    for (let i = 0; i <= N; i++) {
        const { outlines } = resolveMorphAt(entries as MorphEntry[], i / N);
        if (outlines.length === 0) {
            angles.push(angles[angles.length - 1] ?? pose1.angle);
            anisos.push(0);
            continue;
        }
        const p = procrustes(outlines.flat());
        angles.push(p.angle);
        anisos.push(p.anisotropy);
    }

    const conf: number[] = [];
    for (let i = 0; i <= N; i++) {
        if (anisos[i] >= MIN_ANISO) { conf.push(i); }
    }

    const ths = new Array<number>(N + 1);
    if (conf.length === 0) {
        ths.fill(angles[0]);
    } else {
        let prev = angles[conf[0]];
        const vals = conf.map(i => {
            prev = prev + wrapModPi(angles[i] - prev);
            return prev;
        });
        for (let i = 0; i <= N; i++) {
            if (i <= conf[0]) { ths[i] = vals[0]; continue; }
            if (i >= conf[conf.length - 1]) {
                ths[i] = vals[vals.length - 1];
                continue;
            }
            const k = conf.findIndex(c => c >= i);
            if (conf[k] === i) { ths[i] = vals[k]; continue; }
            const f = (i - conf[k - 1]) / (conf[k] - conf[k - 1]);
            ths[i] = vals[k - 1]*(1 - f) + vals[k]*f;
        }
    }

    // Desired end axis: EXACTLY the inverse alignment rotation, on the 2π
    // branch nearest the start - endpoint exactness by construction (no
    // π-parity possible) and residual drift cannot add full turns.
    const rotEnd = -θ;
    const thD0 = ths[0];
    const thsEnd = ths[N];
    const m = round((thD0 - thsEnd - rotEnd) / (2*π));

    return {
        c1: pose1.centroid,
        c2: pose2.centroid,
        s1: pose1.scale,
        s2: pose2.scale,
        thD0,
        thD1: thsEnd + rotEnd + 2*π*m,
        ths
    };
}


/** Wraps an angle into (−π/2, π/2] (axis angles are mod π). */
function wrapModPi(x: number): number {
    let r = x % π;
    if (r > π / 2) { r -= π; }
    if (r < -π / 2) { r += π; }
    return r;
}


/** One piece's geometry slice, optionally walked in reverse (skeleton
 *  reversed; edge sleeves reverse order and swap sides - the boundary
 *  geometry itself keeps its outline direction). */
function sliceGeom(
        branch: FatBranch,
        fromEdge: number,
        toEdge: number,
        reversed: boolean): {
        bz: number[][][];
        rd: number[];
        edges: { out: number[][][]; back: number[][][] }[] } {

    let bz = getSkeletonBeziers(branch).slice(fromEdge, toEdge);
    let rd = getSkeletonRadii(branch).slice(fromEdge, toEdge + 1);
    let edges = getEdgeSleeves(branch).slice(fromEdge, toEdge);

    if (reversed) {
        bz = bz.map(ps => ps.toReversed()).reverse();
        rd = rd.toReversed();
        edges = edges.toReversed()
            .map(e => ({ out: e.back, back: e.out }));
    }

    return { bz, rd, edges };
}


/**
 * A path's composite geometry from its composition recipe.
 */
function composePieces(pieces: PathPiece[]): {
        bz: number[][][];
        rd: number[];
        edges: { out: number[][][]; back: number[][][] }[] } {

    let bz: number[][][] = [];
    let rd: number[] = [];
    let edges: { out: number[][][]; back: number[][][] }[] = [];

    for (const p of pieces) {
        const g = sliceGeom(p.branch, p.fromEdge, p.toEdge, p.reversed);
        bz = [...bz, ...g.bz];
        rd = rd.length === 0 ? g.rd : [...rd, ...g.rd.slice(1)];
        edges = [...edges, ...g.edges];
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
        for (const e of br.children) { walk(e.branch); }
    };
    walk(root);

    // A trim without a topo placement would be ignored; a topo stub host
    // without its trim would collapse in full - keep them consistent.
    for (const host of trims.keys()) { out.add(host); }
    out.delete(root);

    return out;
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]) {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


export { buildMorphEntries }
export type { FeatureMark }
