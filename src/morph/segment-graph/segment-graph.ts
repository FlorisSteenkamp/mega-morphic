import type { FatBranch, FatBranchEdge } from '../fat-branch/fat-branch.js';
import { getSkeletonBeziers } from '../fat-branch/get-fat-branch-tree.js';
import { getSkeletonRadii } from '../fat-branch/get-skeleton-radii.js';
import { totalLength$ } from '../fs/total-length.js';

const { abs } = Math;


/** A fork/leaf vertex of the segment graph. */
interface SegVertex {
    readonly id: number;
    /** vertex position (skeleton point) */
    readonly p: number[];
    /** degree-1 vertex (path endpoints live here) - set after construction */
    leaf: boolean;
}

/** A fork-to-fork/leaf skeleton stretch - no forks in its interior. */
interface Segment {
    readonly v0: number;
    readonly v1: number;
    /** skeleton beziers, v0 → v1 */
    readonly pss: number[][][];
    /** maximal-disk radius per bezier knot (`pss.length + 1` values) */
    readonly radii: number[];
    readonly len: number;
    /** provenance: the fat branch this segment was cut from */
    readonly branch: FatBranch;
    /** edge-index slice [fromEdge, toEdge) of the branch's skeleton */
    readonly fromEdge: number;
    readonly toEdge: number;
}

/**
 * The glyph skeleton cut at every fork: vertices = forks + leaf tips,
 * segments = the stretches between. Unlike the fat-branch tree, NO segment
 * crosses a fork, so any leaf-to-leaf path decomposes into whole segments.
 */
interface SegGraph {
    readonly vertices: SegVertex[];
    readonly segments: Segment[];
    /** per fat branch: its attach vertex + tree edge (undefined for trunk) */
    readonly attachOf: Map<FatBranch, { v: number; edge?: FatBranchEdge }>;
}


/**
 * Builds the segment graph of a fat-branch tree by cutting every branch's
 * skeleton at the knots where its children attach (fork centers are
 * skeleton knots, so no bezier splitting is needed).
 */
function segGraphOf(tree: FatBranch): SegGraph {
    const vertices: SegVertex[] = [];
    const segments: Segment[] = [];
    const attachOf =
        new Map<FatBranch, { v: number; edge?: FatBranchEdge }>();

    const newVertex = (p: number[]): number => {
        vertices.push({ id: vertices.length, p, leaf: false });
        return vertices.length - 1;
    };

    /** @param attachEnd vertex the branch's junction end connects to */
    const addBranch = (branch: FatBranch, attachEnd?: number): void => {
        const pss = getSkeletonBeziers(branch);
        const radii = getSkeletonRadii(branch);
        if (pss.length === 0) { return; }

        // cumulative arc length at each knot
        const cum = [0];
        for (const ps of pss) {
            cum.push(cum[cum.length - 1] + totalLength$(ps));
        }
        const last = pss.length;  // last knot index

        // children → nearest knot (fork centers are knots)
        const knotOf = (d: number): number => {
            let k = 0;
            for (let i = 1; i <= last; i++) {
                if (abs(cum[i] - d) < abs(cum[k] - d)) { k = i; }
            }
            return k;
        };
        const byKnot = new Map<number, FatBranchEdge[]>();
        for (const e of branch.children) {
            const k = knotOf(e.distanceFromLeaf);
            let list = byKnot.get(k);
            if (list === undefined) { byKnot.set(k, list = []); }
            list.push(e);
        }

        const tipV = newVertex(pss[0][0]);
        const endV = attachEnd ?? newVertex(pss[last - 1].at(-1)!);

        const cuts = [...byKnot.keys()]
            .filter(k => k > 0 && k < last)
            .sort((a, b) => a - b);

        // vertex at each knot boundary of the branch's segment chain
        const boundKnots = [0, ...cuts, last];
        const boundVs = [
            tipV,
            ...cuts.map(k => newVertex(pss[k - 1].at(-1)!)),
            endV
        ];

        for (let i = 0; i + 1 < boundKnots.length; i++) {
            const k0 = boundKnots[i];
            const k1 = boundKnots[i + 1];
            segments.push({
                v0: boundVs[i],
                v1: boundVs[i + 1],
                pss: pss.slice(k0, k1),
                radii: radii.slice(k0, k1 + 1),
                len: cum[k1] - cum[k0],
                branch,
                fromEdge: k0,
                toEdge: k1
            });
        }

        for (const [k, children] of byKnot) {
            // children at the extreme knots attach to the tip/end vertex
            const v = k <= 0 ? tipV
                : k >= last ? endV
                : boundVs[cuts.indexOf(k) + 1];
            for (const e of children) {
                attachOf.set(e.branch, { v, edge: e });
                addBranch(e.branch, v);
            }
        }
    };

    attachOf.set(tree, { v: -1 });
    addBranch(tree);

    const degree = new Array(vertices.length).fill(0);
    for (const s of segments) {
        degree[s.v0]++;
        degree[s.v1]++;
    }
    for (const v of vertices) { v.leaf = degree[v.id] === 1; }

    return { vertices, segments, attachOf };
}


/**
 * The unique route between two vertices (the graph is a tree), as segments
 * in travel order.
 */
function routeSegments(
        g: SegGraph,
        v0: number,
        v1: number): { seg: Segment; reversed: boolean }[] {

    const adj: { seg: Segment; to: number }[][] =
        g.vertices.map(() => []);
    for (const seg of g.segments) {
        adj[seg.v0].push({ seg, to: seg.v1 });
        adj[seg.v1].push({ seg, to: seg.v0 });
    }

    const prev = new Array<{ seg: Segment; from: number } | undefined>(
        g.vertices.length);
    const seen = new Set([v0]);
    const queue = [v0];
    while (queue.length > 0) {
        const u = queue.shift()!;
        if (u === v1) { break; }
        for (const { seg, to } of adj[u]) {
            if (!seen.has(to)) {
                seen.add(to);
                prev[to] = { seg, from: u };
                queue.push(to);
            }
        }
    }

    const out: { seg: Segment; reversed: boolean }[] = [];
    let u = v1;
    while (u !== v0) {
        const p = prev[u];
        if (p === undefined) { return []; }  // disconnected (shouldn't happen)
        out.push({ seg: p.seg, reversed: p.seg.v1 !== u });
        u = p.from;
    }
    return out.reverse();
}


export { segGraphOf, routeSegments }
export type { SegGraph, Segment, SegVertex }
