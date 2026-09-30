declare var _debug_: Debug; 
import type { Debug } from '../../debug/debug.js';
import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { MorphEntry, MutableMorphEntry } from '../morph-entry.js';
import type { AnchorPair } from '../align-branches.js';
import type { MatchedPath } from '../match-paths/matched-path.js';
import type { PathCostWeights } from '../match-paths/path-cost-weights.js';
import type { PoseRamp, PoseComponents } from '../pose-ramp.js';
import type { Segment } from '../segment-graph/segment.js';
import type { SegGraph } from '../segment-graph/seg-graph.js';
import { getShapeArea } from 'flo-boolean';
import { matchPathsViaSegments } from '../segment-graph/match-paths-via-segments.js';
import { segGraphOf } from '../segment-graph/segment-graph.js';
import { composeRouteGeom } from '../segment-graph/compose-segs.js';
import { procrustes } from '../procrustes/procrustes-analysis.js';
import { resolveMorphAt } from '../resolve-morph-at/resolve-morph-at.js';
import { alignBranches, resampleAt } from '../align-branches.js';
import { buildSleeveSides, skeletonKnots } from '../anchored-sleeves.js';
import { getLastP } from '../fs/get-last-p.js';
import { clamp } from '../../utils/clamp.js';
import { matchColors } from '../../page/events/match-colors.js';
import { nearestIdx } from '../nearest-idx.js';
import { placeTopology } from '../place-topology.js';
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

    const entries: MutableMorphEntry[] = [];

    /** per entry: its resampled segment boundary points, per side */
    const bnds: { a?: number[][]; b?: number[][] }[] = [];

    /** covered segment → owning entry index (per side; placeTopology adds
     *  placed segments as glue hosts for chained uncovered neighbors) */
    const owner1 = new Map<Segment, number>();
    const owner2 = new Map<Segment, number>();

    // Every segment covered by SOME matched route (per tree) - the rest
    // retracts/grows as per-segment collapsed entries.
    const covered1 = coveredSegsOf(pm.trunk, 'a');
    const covered2 = coveredSegsOf(pm.trunk, 'b');

    let pairIdx = 0;

    buildPair(pm.trunk);

    // Whatever no matched route covers collapses onto its coverage-side
    // vertex, closest-to-coverage first.
    placeTopology(gA, covered1, owner1, 'a',
        'red thin35 nofill', capSign, bnds, entries, marks);
    placeTopology(gB, covered2, owner2, 'b',
        'green thin35 nofill', capSign, bnds, entries, marks);

    if (poseOut !== undefined) {
        poseOut.ramp = applyProcrustes(
            tree1, tree2, entries, poseOut.components);
    }

    return entries as MorphEntry[];


    /**
     * Builds the entry for one matched path pair, then recursively its
     * matched children's entries (glued onto this one). Returns the index.
     */
    function buildPair(mp: MatchedPath): number {

        const i = pairIdx++;
        const idx = entries.length;

        const gA = composeRouteGeom(mp.routeA);
        const gB = composeRouteGeom(mp.routeB);

        for (const st of mp.routeA) { owner1.set(st.seg, idx); }
        for (const st of mp.routeB) { owner2.set(st.seg, idx); }

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

        // Children: build each matched sub-pair and glue it to this entry -
        // at the aligned fork anchor when kept, else at the per-frame
        // nearest boundary.
        matchOps.forEach((op, n) => {
            const childIdx = buildPair(op.sub);

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


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]) {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


export { buildMorphEntries, coveredSegsOf, branchSegsOf }
export type { FeatureMark }
