import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { PathGeom } from './path-geom.js';
import type { TrunkPathEnd } from './trunk-path-end.js';
import { length } from 'flo-bezier3';
import { getSkeletonBeziers, getSkeletonRadii } from '../fat-branch/get-fat-branch-tree.js';
import { edgeIndexAt } from '../edge-index-at.js';
import { sum } from '../../utils/sum.js';

const { max, PI: π } = Math;


/** Reversal memoized per candidate (samples cache on the geometry). */
const reversedCache = new WeakMap<PathGeom, PathGeom>();
function reversedOf(pg: PathGeom): PathGeom {
    let r = reversedCache.get(pg);
    if (r === undefined) {
        r = reverseGeom(pg);
        reversedCache.set(pg, r);
    }
    return r;
}


/** The same path traversed end → start: pieces reversed (order + flags),
 *  geometry reversed, pooled forks mirrored (side/angle flip). */
function reverseGeom(pg: PathGeom): PathGeom {
    return {
        pieces: [...pg.pieces].reverse()
            .map(p => ({ ...p, reversed: !p.reversed })),
        bz: pg.bz.map(ps => [...ps].reverse()).reverse(),
        rd: [...pg.rd].reverse(),
        L: pg.L,
        stubSal: pg.stubSal,
        stubN: pg.stubN,
        pooled: pg.pooled.map(c => ({
            edge: c.edge,
            dist: pg.L - c.dist,
            side: c.side === 1 ? -1 : 1,
            // Reversing the travel direction maps θ to θ − sign(θ)·π.
            angle: c.angle > 0 ? c.angle - π : c.angle + π
        }))
    };
}


/**
 * Leaf-to-leaf trunk path candidates: the trunk traversed from a start to
 * an end that is either its own tip or a REROUTE - an exit at a fork into
 * a child subtree's descending path (whose bypassed trunk tip stretch
 * becomes an unmatched stub). One candidate per (start, end) choice.
 */
function trunkCandidates(
        trunk: FatBranch,
        pathsOf: (br: FatBranch) => PathGeom[]): PathGeom[] {

    const bz = getSkeletonBeziers(trunk);
    const rd = getSkeletonRadii(trunk);
    const lens = bz.map(ps => length([0, 1], ps));
    const children = trunk.children ?? [];

    const starts: TrunkPathEnd[] = [{ j: 0, jLen: 0, stub: 0 }];
    const ends: TrunkPathEnd[] = [{ j: bz.length, jLen: sum(lens), stub: 0 }];
    for (const exit of children) {
        const j = edgeIndexAt(bz, exit.distanceFromLeaf);
        const jLen = sum(lens.slice(0, j));
        for (const sub of pathsOf(exit.branch)) {
            starts.push({ j, jLen, exit, sub,
                stub: exit.roundSalienceFromLeaf });
            // Complement of the tip piece MINUS the exit subtree itself
            // (the rerouted-into material is ON the path, not stub).
            ends.push({ j, jLen, exit, sub,
                stub: max(0, trunk.roundSalience
                    - exit.roundSalienceFromLeaf
                    - exit.branch.roundSalience) });
        }
    }

    const out: PathGeom[] = [];
    for (const s of starts) {
        for (const e of ends) {
            if (s.j >= e.j || s.exit === e.exit && s.exit !== undefined) {
                continue;
            }

            const midBz = bz.slice(s.j, e.j);
            const midRd = rd.slice(s.j, e.j + 1);
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
                ? undefined : reverseGeom(e.sub);

            // Children swallowed inside the bypassed trunk stubs.
            const swallowedS = s.exit === undefined ? 0 : children
                .filter(c => c !== s.exit &&
                    c.distanceFromLeaf < s.jLen).length;
            const swallowedE = e.exit === undefined ? 0 : children
                .filter(c => c !== e.exit &&
                    c.distanceFromLeaf > e.jLen).length;

            out.push({
                pieces: [
                    ...(s.sub?.pieces ?? []),
                    { branch: trunk, fromEdge: s.j, toEdge: e.j,
                      reversed: false },
                    ...(post?.pieces ?? [])
                ],
                bz: [
                    ...(s.sub?.bz ?? []), ...midBz, ...(post?.bz ?? [])
                ],
                rd: [
                    ...(s.sub?.rd ?? []), ...midRd,
                    ...(post?.rd.slice(1) ?? [])
                ],
                L: preL + midL + (post?.L ?? 0),
                stubSal: (s.sub?.stubSal ?? 0) + s.stub +
                    (post?.stubSal ?? 0) + e.stub,
                stubN: (s.sub?.stubN ?? 0) + (post?.stubN ?? 0) +
                    (s.exit !== undefined && s.j > 0 ? 1 : 0) +
                    (e.exit !== undefined && e.j < bz.length ? 1 : 0) +
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


export { trunkCandidates, reversedOf }