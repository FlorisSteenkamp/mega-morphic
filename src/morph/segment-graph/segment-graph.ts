import type { FatBranch, FatBranchEdge } from '../fat-branch/fat-branch.js';
import type { SegVertex } from './seg-vertex.js';
import type { Segment } from './segment.js';
import type { SegGraph } from './seg-graph.js';
import { getSkeletonBeziers } from '../fat-branch/get-fat-branch-tree.js';
import { getSkeletonRadii } from '../fat-branch/get-skeleton-radii.js';
import { getEdgeSleeves } from '../anchored-sleeves.js';
import { totalLength$ } from '../fs/total-length.js';
import { mean } from '../../utils/mean.js';

const { abs } = Math;


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
    const parentOf = new Map<FatBranch, FatBranch>();

    const newVertex = (p: number[]): number => {
        vertices.push({ id: vertices.length, p });
        return vertices.length - 1;
    };

    /** @param attachEnd vertex the branch's junction end connects to */
    const addBranch = (branch: FatBranch, attachEnd?: number): void => {
        const pss = getSkeletonBeziers(branch);
        const radii = getSkeletonRadii(branch);
        if (pss.length === 0) { return; }
        const sleeves = getEdgeSleeves(branch);

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
            const rd = radii.slice(k0, k1 + 1);
            const len = cum[k1] - cum[k0];
            segments.push({
                v0: boundVs[i],
                v1: boundVs[i + 1],
                pss: pss.slice(k0, k1),
                radii: rd,
                len,
                material: 2*mean(rd)*len,
                sleeves: sleeves.slice(k0, k1),
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
                parentOf.set(e.branch, branch);
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

    return { root: tree, vertices, segments, attachOf, parentOf };
}


export { segGraphOf }
