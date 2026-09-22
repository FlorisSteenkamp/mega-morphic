import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { PathGeom } from './path-geom.js';
import { memoize } from 'flo-memoize';
import { getSkeletonBeziers } from '../fat-branch/get-fat-branch-tree.js';
import { skeletonKnotIndexAt } from '../skeleton-knot-index-at.js';
import { totalLength$ } from '../fs/total-length.js';
import { getSkeletonRadii } from '../fat-branch/get-skeleton-radii.js';
import { sum } from '../../utils/sum.js';


/**
 * Returns the enumeration of all junction-to-leaf paths under a branch
 * (one per leaf of the subtree), with composed geometry.
 */
const pathsOf$ = memoize(function(
        fatBranch: FatBranch): PathGeom[] {

    const skelPss = getSkeletonBeziers(fatBranch);
    const radii = getSkeletonRadii(fatBranch);
    const lens = skelPss.map(totalLength$);
    const L = sum(lens);
    const children = fatBranch.children;

    // The path ending at this branch's own leaf tip.
    const own: PathGeom = {
        pieces: [{
            branch: fatBranch,
            fromEdge: 0,
            toEdge: skelPss.length,
            reversed: false
        }],
        skelPss: skelPss,
        radii,
        L,
        stubSal: 0,
        stubN: 0,
        pooled: children.map(edge => ({
            edge,
            dist: edge.distanceFromLeaf,
            side: edge.side,
            angle: edge.angle
        }))
    };

    const out: PathGeom[] = [own];

    // Paths continuing through a child: the child's sub-path plus this
    // branch's stretch from the exit fork to its junction; the leaf-side
    // stub (incl. anything hanging off it) goes unmatched.
    for (const exit of children) {
        const j = skeletonKnotIndexAt(skelPss, exit.distanceFromLeaf);
        const stretchPss = skelPss.slice(j);
        const stretchRadii = radii.slice(j + 1);
        // Measure from the actual slice knot so pooled distances land
        // exactly on the composed skeleton.
        const jLen = sum(lens.slice(0, j));
        const stretchL = L - jLen;

        const onPath = children
            .filter(
                e => e !== exit &&
                e.distanceFromLeaf >= exit.distanceFromLeaf
            );
        const swallowed = children
            .filter(e => e !== exit &&
                e.distanceFromLeaf < exit.distanceFromLeaf).length;

        for (const sub of pathsOf$(exit.branch)) {
            out.push({
                pieces: [...sub.pieces, {
                    branch: fatBranch,
                    fromEdge: j,
                    toEdge: skelPss.length,
                    reversed: false
                }],
                skelPss: [...sub.skelPss, ...stretchPss],
                radii: [...sub.radii, ...stretchRadii],
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

    return out;
});


export { pathsOf$ }