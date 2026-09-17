import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { Context } from './context.js';
import type { PathGeom } from './path-geom.js';
import { length } from 'flo-bezier3';
import { getSkeletonBeziers, getSkeletonRadii } from '../fat-branch/get-fat-branch-tree.js';
import { edgeIndexAt } from '../edge-index-at.js';


function makeContext(
        tree1: FatBranch,
        tree2: FatBranch): Context {

    return {
        // w,
        unit1: Math.sqrt(tree1.roundSalience),
        unit2: Math.sqrt(tree2.roundSalience),
        sal1: tree1.roundSalience,
        sal2: tree2.roundSalience,
        paths1: makePathCache(),
        paths2: makePathCache(),
        memo: new Map()
    };
}


/**
 * Memoized enumeration of all junction-to-leaf paths under a branch
 * (one per leaf of the subtree), with composed geometry.
 */
function makePathCache(): (br: FatBranch) => PathGeom[] {
    const cache = new Map<FatBranch, PathGeom[]>();

    return function pathsOf(br: FatBranch): PathGeom[] {
        const cached = cache.get(br);
        if (cached !== undefined) { return cached; }

        const bz = getSkeletonBeziers(br);
        const rd = getSkeletonRadii(br);
        const lens = bz.map(ps => length([0, 1], ps));
        const L = lens.reduce((s, l) => s + l, 0);
        const children = br.children ?? [];

        // The path ending at this branch's own leaf tip.
        const own: PathGeom = {
            pieces: [{ branch: br, fromEdge: 0, toEdge: bz.length,
                reversed: false }],
            bz, rd, L,
            stubSal: 0,
            stubN: 0,
            pooled: children.map(edge => ({
                edge, dist: edge.distanceFromLeaf,
                side: edge.side, angle: edge.angle
            }))
        };

        const out: PathGeom[] = [own];

        // Paths continuing through a child: the child's sub-path plus this
        // branch's stretch from the exit fork to its junction; the leaf-side
        // stub (incl. anything hanging off it) goes unmatched.
        for (const exit of children) {
            const j = edgeIndexAt(bz, exit.distanceFromLeaf);
            const stretchBz = bz.slice(j);
            const stretchRd = rd.slice(j + 1);
            // Measure from the actual slice knot so pooled distances land
            // exactly on the composed skeleton.
            const jLen = lens.slice(0, j).reduce((s, l) => s + l, 0);
            const stretchL = L - jLen;

            const onPath = children
                .filter(e => e !== exit &&
                    e.distanceFromLeaf >= exit.distanceFromLeaf);
            const swallowed = children
                .filter(e => e !== exit &&
                    e.distanceFromLeaf < exit.distanceFromLeaf).length;

            for (const sub of pathsOf(exit.branch)) {
                out.push({
                    pieces: [...sub.pieces,
                        { branch: br, fromEdge: j, toEdge: bz.length,
                          reversed: false }],
                    bz: [...sub.bz, ...stretchBz],
                    rd: [...sub.rd, ...stretchRd],
                    L: sub.L + stretchL,
                    stubSal: sub.stubSal + exit.roundSalienceFromLeaf,
                    stubN: sub.stubN + (j >= 1 ? 1 : 0) + swallowed,
                    pooled: [
                        ...sub.pooled,
                        ...onPath.map(edge => ({
                            edge,
                            dist: sub.L + (edge.distanceFromLeaf - jLen),
                            side: edge.side, angle: edge.angle
                        }))
                    ]
                });
            }
        }

        cache.set(br, out);
        return out;
    };
}


export { makeContext }