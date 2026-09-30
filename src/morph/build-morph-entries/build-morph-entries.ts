declare var _debug_: Debug; 
import type { Debug } from '../../debug/debug.js';
import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { MorphEntry, MutableMorphEntry } from '../morph-entry.js';
import type { AnchorPair } from '../align-branches.js';
import type { MatchedPath } from '../match-paths/matched-path.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { EntryLoc, Trim } from '../place-topology.js';
import type { PoseRamp, PoseComponents } from '../pose-ramp.js';
import type { Segment, RouteStep } from '../segment-graph/segment.js';
import type { SegGraph } from '../segment-graph/seg-graph.js';
import { getShapeArea } from 'flo-boolean';
import { matchPathsViaSegments } from '../segment-graph/match-paths-via-segments.js';
import { segGraphOf } from '../segment-graph/segment-graph.js';
import { composeSegs, composeRouteGeom, runsOf } from '../segment-graph/compose-segs.js';
import type { Run } from '../segment-graph/compose-segs.js';
import { procrustes } from '../procrustes/procrustes-analysis.js';
import { resolveMorphAt } from '../resolve-morph-at/resolve-morph-at.js';
import { alignBranches, resampleAt } from '../align-branches.js';
import { buildSleeveSides, skeletonKnots } from '../anchored-sleeves.js';
import { getLastP } from '../fs/get-last-p.js';
import { clamp } from '../../utils/clamp.js';
import { matchColors } from '../../page/events/match-colors.js';
import { nearestIdx } from '../nearest-idx.js';
import { placeTopology, pushCollapsedEntry } from '../place-topology.js';
import { getPolyBezierLength } from '../fs/get-poly-bezier-length.js';

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
 * 
 * @param tree1
 * @param tree2
 * @param marks
 * @param weights
 * @param poseOut pass to enable pose alignment: the ENABLED components of shape
 * 2's frame are aligned onto shape 1 for the morph, and the
 * returned `ramp` restores its true pose over t (apply when
 * drawing)
 */
function buildMorphEntries(
        tree1: FatBranch,
        tree2: FatBranch,
        marks: FeatureMark[],
        weights?: Partial<PathCostWeights>,
        poseOut?: { components: PoseComponents; ramp?: PoseRamp }):
        MorphEntry[] {

    const gA = segGraphOf(tree1);
    const gB = segGraphOf(tree2);
    const pm = matchPathsViaSegments(gA, gB, { weights });

    // The morph arrays only exist when morph debugging is enabled (other
    // debug configs, e.g. flo-boolean-only in tests, lack them).
    if (typeof _debug_ !== 'undefined' &&
        _debug_.elems?.pathMatchResult !== undefined) {
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

    // every branch's graph segments, tip → junction (per tree)
    const segsOf1 = branchSegsOf(gA);
    const segsOf2 = branchSegsOf(gB);

    const entries: MutableMorphEntry[] = [];

    /** entry location(s) of every fat branch (a branch may be covered by
     *  several entries - trunk middle + matched terminal tip) */
    const entryLoc = new Map<FatBranch, EntryLoc[]>();

    /** per entry: its resampled segment boundary points, per side */
    const bnds: { a?: number[][]; b?: number[][] }[] = [];

    /** branches fully covered by a matched path (per tree) */
    const onPath1 = new Set<FatBranch>();
    const onPath2 = new Set<FatBranch>();

    /** stub hosts: their leaf-side remainder retracts (per tree) */
    const trims1 = new Map<FatBranch, Trim>();
    const trims2 = new Map<FatBranch, Trim>();

    // Every segment covered by SOME matched route (per tree): bypassed
    // slices that another pair covers must NOT also retract as stubs/trims.
    const covered1 = coveredSegsOf(pm.trunk, 'a');
    const covered2 = coveredSegsOf(pm.trunk, 'b');

    let pairIdx = 0;
    /**
     * bypassed trunk-stub entries per HOST BRANCH (glue candidates for
     * children hanging off the bypassed stretch), per side
     */
    const stubEntries1 = new Map<FatBranch, number[]>();
    const stubEntries2 = new Map<FatBranch, number[]>();

    buildPair(pm.trunk, true);

    // Whatever no matched path covers collapses: whole unmatched subtrees
    // in full, stub hosts trimmed to their leaf-side remainders.
    placeTopology(gA.parentOf, segsOf1,
        topoSetOf(segsOf1, tree1, onPath1, trims1), 'a',
        'red thin35 nofill', capSign, trims1, entryLoc, bnds, entries,
        stubEntries1, marks);
    placeTopology(gB.parentOf, segsOf2,
        topoSetOf(segsOf2, tree2, onPath2, trims2), 'b',
        'green thin35 nofill', capSign, trims2, entryLoc, bnds, entries,
        stubEntries2, marks);

    if (poseOut !== undefined) {
        poseOut.ramp = applyProcrustes(
            tree1, tree2, entries, poseOut.components);
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

        const gA = composeRouteGeom(mp.routeA);
        const gB = composeRouteGeom(mp.routeB);

        registerRoute(entryLoc, mp.routeA, 'a', idx, tree1, onPath1,
            trims1, covered1, segsOf1, isTrunk);
        registerRoute(entryLoc, mp.routeB, 'b', idx, tree2, onPath2,
            trims2, covered2, segsOf2, isTrunk);

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
            skelPssA: mA.beziers,
            skelPssB: mB.beziers,
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
            pushTrunkStubs(capSign, entries, bnds, marks, mp.routeA, 'a', idx, bndA,
                'red thin35 nofill', stubEntries1, covered1, segsOf1);
            pushTrunkStubs(capSign, entries, bnds, marks, mp.routeB, 'b', idx, bndB,
                'green thin35 nofill', stubEntries2, covered2, segsOf2);
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
                const k1 = nearestIdx(bndA, getLastP(entries[childIdx].skelPssA));
                const k2 = nearestIdx(bndB, getLastP(entries[childIdx].skelPssB));
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


/** Registers a route's branches: entry location for all, fully-covered
 *  ones as on-path, partially-covered hosts with their trim (shrunk past
 *  any segments another matched pair covers). */
function registerRoute(
        entryLoc: Map<FatBranch, EntryLoc[]>,
        route: RouteStep[],
        side: 'a' | 'b',
        idx: number,
        root: FatBranch,
        onPath: Set<FatBranch>,
        trims: Map<FatBranch, Trim>,
        covered: Set<Segment>,
        segsOf: Map<FatBranch, Segment[]>,
        isTrunk: boolean): void {

    const runs = runsOf(route);
    const isFull = (r: Run): boolean =>
        r.segs.length === segsOf.get(r.branch)!.length;

    // The absorber must stay mapped to THIS entry (full runs are
    // never re-mapped by placeTopology). Fork-terminated routes may have
    // no full run - fall back to the longest one.
    const absorber = (
        runs.find(isFull) ??
            runs.reduce((a, b) => edgeSpan(b) > edgeSpan(a) ? b : a)
    ).branch;

    for (const r of runs) {
        let locs = entryLoc.get(r.branch);
        if (locs === undefined) { entryLoc.set(r.branch, locs = []); }
        locs.push({ idx, side });
        // ALL trunk runs' remainders are handled by pushTrunkStubs (the
        // trunk may cross a branch between two interior forks, leaving
        // remainders on BOTH sides - trims are one-sided)
        if (isTrunk) {
            onPath.add(r.branch);
            continue;
        }
        // shrink the leaf-side remainder past covered (matched) segments
        const bSegs = segsOf.get(r.branch)!;
        let j = bSegs.indexOf(r.segs[0]);
        while (j > 0 && covered.has(bSegs[j - 1])) { j--; }
        if (isFull(r) || r.branch === root || j === 0) {
            // Full, the trunk (stubs handled separately), or an empty
            // stub - nothing left to retract via placeTopology.
            onPath.add(r.branch);
        } else {
            trims.set(r.branch, { keep: bSegs.slice(0, j), absorber });
        }
    }
}


/** A run's covered skeleton-edge count. */
function edgeSpan(r: Run): number {
    return r.segs[r.segs.length - 1].toEdge - r.segs[0].fromEdge;
}


/** Every branch's graph segments, tip → junction order. */
function branchSegsOf(g: SegGraph): Map<FatBranch, Segment[]> {
    const out = new Map<FatBranch, Segment[]>();
    for (const s of g.segments) {
        let list = out.get(s.branch);
        if (list === undefined) { out.set(s.branch, list = []); }
        list.push(s);
    }
    return out;
}


/** Every segment covered by some matched route, one tree's side. */
function coveredSegsOf(
        trunk: MatchedPath,
        side: 'a' | 'b'): Set<Segment> {

    const out = new Set<Segment>();
    const walk = (mp: MatchedPath): void => {
        for (const st of side === 'a' ? mp.routeA : mp.routeB) {
            out.add(st.seg);
        }
        for (const op of mp.children) {
            if (op.type === 'match') { walk(op.sub); }
        }
    };
    walk(trunk);
    return out;
}


/** Collapse entries for the trunk route's bypassed stretches (each
 *  run's uncovered remainders - the trunk may cross branches between
 *  interior forks): the tip-side stub in its own orientation, the
 *  junction-side stub reversed - both ending at their fork knot, glued
 *  onto the trunk pair's entry. Segments covered by a matched pair
 *  (terminal children) are skipped. */
function pushTrunkStubs(
        capSign: number,
        entries: MutableMorphEntry[],
        bnds: { a?: number[][]; b?: number[][] }[],
        marks: FeatureMark[],
        route: RouteStep[],
        side: 'a' | 'b',
        pairIdx_: number,
        bnd: number[][],
        classes: string,
        stubEntries: Map<FatBranch, number[]>,
        covered: Set<Segment>,
        segsOf: Map<FatBranch, Segment[]>): void {

    for (const r of runsOf(route)) {
        const bSegs = segsOf.get(r.branch)!;
        const stubs: { segs: Segment[]; reversed: boolean }[] = [];

        // tip-side remainder: keep only the uncovered prefix
        let f = bSegs.indexOf(r.segs[0]);
        while (f > 0 && covered.has(bSegs[f - 1])) { f--; }
        if (f > 0) {
            stubs.push({ segs: bSegs.slice(0, f), reversed: false });
        }
        // junction-side remainder: uncovered suffix
        let t = bSegs.indexOf(r.segs[r.segs.length - 1]) + 1;
        while (t < bSegs.length && covered.has(bSegs[t])) { t++; }
        if (t < bSegs.length) {
            stubs.push({ segs: bSegs.slice(t), reversed: true });
        }

        for (const s of stubs) {
            const g = composeSegs(s.segs, s.reversed);
            const junction = getLastP(g.bz);
            const k = nearestIdx(bnd, junction);
            let list = stubEntries.get(r.branch);
            if (list === undefined) {
                stubEntries.set(r.branch, list = []);
            }
            list.push(pushCollapsedEntry(
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
        entries: MutableMorphEntry[],
        comp: PoseComponents): PoseRamp {

    const pose1 = procrustes(tree1.pss);
    const pose2 = procrustes(tree2.pss);

    const s = comp.scale ? pose1.scale / pose2.scale : 1;
    // Principal axes are only defined mod π - take the smaller rotation.
    const θ = comp.moment ? wrapModPi(pose1.angle - pose2.angle) : 0;

    const cosθ = cos(θ);
    const sinθ = sin(θ);
    const [c2x, c2y] = pose2.centroid;
    // centroid off: rotate/scale shape 2 in place (about its own centroid)
    const [c1x, c1y] = comp.centroid ? pose1.centroid : pose2.centroid;
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
        if (e.collapsed === 'a') { e.skelPssA = e.skelPssA.map(ps => ps.map(tf)); }
        e.skelPssB = e.skelPssB.map(ps => ps.map(tf));
        if (e.rb !== undefined) { e.rb = e.rb.map(r => r * s); }
    }

    // Measured axis angles of the aligned-frame morph, sampled over t and
    // UNWRAPPED (period π). Branch decisions are chained ONLY through
    // samples whose axis is measurable (near isotropy the angle is pure
    // noise and nearest-branch chaining random-walks by ±π/2 hops -
    // accumulating spurious full turns); unmeasurable stretches are filled
    // by interpolation between confident neighbors.
    // Only needed when the moment component is pinned (33 morph resolves).
    if (!comp.moment) {
        return {
            c1: pose1.centroid,
            c2: pose2.centroid,
            s1: pose1.scale,
            s2: pose2.scale,
            thD0: 0,
            thD1: 0,
            ths: [0, 0],
            pin: comp
        };
    }
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
        ths,
        pin: comp
    };
}


/** Wraps an angle into (−π/2, π/2] (axis angles are mod π). */
function wrapModPi(x: number): number {
    let r = x % π;
    if (r > π / 2) { r -= π; }
    if (r < -π / 2) { r += π; }
    return r;
}


/** All graph branches not fully covered by a matched path (stub hosts
 *  keep their trim: only the leaf-side remainder collapses). */
function topoSetOf(
        segsOf: Map<FatBranch, Segment[]>,
        root: FatBranch,
        onPath: Set<FatBranch>,
        trims: Map<FatBranch, Trim>): Set<FatBranch> {

    const out = new Set<FatBranch>();
    for (const br of segsOf.keys()) {
        if (!onPath.has(br)) { out.add(br); }
    }

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


export { buildMorphEntries, coveredSegsOf, branchSegsOf }
export type { FeatureMark }
