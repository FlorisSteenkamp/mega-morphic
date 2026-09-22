import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { PathGeom } from './path-geom.js';
import type { TrunkPathEnd } from './trunk-path-end.js';
import { getSkeletonBeziers } from '../fat-branch/get-fat-branch-tree.js';
import { skeletonKnotIndexAt } from '../skeleton-knot-index-at.js';
import { sum } from '../../utils/sum.js';
import { pathsOf$ } from './paths-of.js';
import { reverseGeom$ } from './reverse-geom.js';
import { totalLength$ } from '../fs/total-length.js';
import { getSkeletonRadii } from '../fat-branch/get-skeleton-radii.js';

const { max } = Math;


/**
 * Leaf-to-leaf trunk path candidates: the trunk traversed from a start to
 * an end that is either its own tip or a REROUTE - an exit at a fork into
 * a child subtree's descending path (whose bypassed trunk tip stretch
 * becomes an unmatched stub). One candidate per (start, end) choice.
 */
function trunkCandidates(
        trunk: FatBranch): PathGeom[] {

    const pss = getSkeletonBeziers(trunk);
    const radii = getSkeletonRadii(trunk);
    const lens = pss.map(totalLength$);
    const { children } = trunk;

    const starts: TrunkPathEnd[] = [{ j: 0, jLen: 0, stub: 0 }];
    const ends: TrunkPathEnd[] = [{ j: pss.length, jLen: sum(lens), stub: 0 }];

    for (const exit of children) {
        const j = skeletonKnotIndexAt(pss, exit.distanceFromLeaf);
        const jLen = sum(lens.slice(0, j));

        const paths = pathsOf$(exit.branch);
        for (const sub of paths) {
            starts.push({
                j, jLen, exit, sub,
                stub: exit.roundSalienceFromLeaf
            });
            // Complement of the tip piece: the trunk's far-side remainder.
            // (The rerouted-into subtree is never part of trunk.roundSalience
            // - the trunk outline caps at the fork circles - so it must not
            // be subtracted.)
            const stub =
                trunk.roundSalience -
                exit.roundSalienceFromLeaf;
            // console.log({
            //     stub,
            //     rel: stub / trunk.roundSalience,
            //     at: exit.distanceFromLeaf / sum(lens)  // 0 = leaf tip, 1 = far end
            // });
            ends.push({
                j, jLen, exit, sub,
                stub: max(0, stub)
            });
        }
    }

    const out: PathGeom[] = [];
    for (const s of starts) {
        for (const e of ends) {
            if (s.j >= e.j || s.exit === e.exit && s.exit !== undefined) {
                continue;
            }

            const midPss = pss.slice(s.j, e.j);
            const midRadii = radii.slice(s.j, e.j + 1);
            const midL = e.jLen - s.jLen;
            const preL = s.sub?.L ?? 0;

            // Trunk children between the exits, in trunk direction.
            const midPooled = children
                .filter(c => c !== s.exit && c !== e.exit &&
                    c.distanceFromLeaf >= s.jLen &&
                    c.distanceFromLeaf <= e.jLen)
                .map(c => ({
                    edge: c, dist: preL + (c.distanceFromLeaf - s.jLen),
                    side: c.side, angle: c.angle
                }));

            // End-side sub-path traversed junction → leaf (reversed).
            const post = e.sub === undefined
                ? undefined : reverseGeom$(e.sub);

            // Children swallowed inside the bypassed trunk stubs.
            const swallowedS = s.exit === undefined ? 0 : children
                .filter(
                    c => c !== s.exit &&
                    c.distanceFromLeaf < s.jLen
                ).length;

            const swallowedE = e.exit === undefined ? 0 : children
                .filter(
                    c => c !== e.exit &&
                    c.distanceFromLeaf > e.jLen
                ).length;

            out.push({
                pieces: [
                    ...(s.sub?.pieces ?? []),
                    { branch: trunk, fromEdge: s.j, toEdge: e.j,
                      reversed: false },
                    ...(post?.pieces ?? [])
                ],
                skelPss: [
                    ...(s.sub?.skelPss ?? []), ...midPss, ...(post?.skelPss ?? [])
                ],
                radii: [
                    ...(s.sub?.radii ?? []), ...midRadii,
                    ...(post?.radii.slice(1) ?? [])
                ],
                L: preL + midL + (post?.L ?? 0),
                stubSal: (s.sub?.stubSal ?? 0) + s.stub +
                    (post?.stubSal ?? 0) + e.stub,
                stubN: (s.sub?.stubN ?? 0) + (post?.stubN ?? 0) +
                    (s.exit !== undefined && s.j > 0 ? 1 : 0) +
                    (e.exit !== undefined && e.j < pss.length ? 1 : 0) +
                    swallowedS + swallowedE,
                pooled: [
                    ...(s.sub?.pooled ?? []),
                    ...midPooled,
                    ...(post?.pooled.map(c => ({
                        ...c, dist: preL + midL + c.dist
                    })) ?? [])
                ]
            });
        }
    }

    return out;
}


export { trunkCandidates }