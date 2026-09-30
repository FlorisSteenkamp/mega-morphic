import type { CpNode } from 'flo-mat';
import { getMatCurveToNext, getBoundaryBeziersToNext } from 'flo-mat';
import type { SegVertex } from './seg-vertex.js';
import { getCircleId } from '../fat-branch/get-circle-id.js';
import { totalLength$ } from '../fs/total-length.js';
import { sum } from '../../utils/sum.js';
import { mean } from '../../utils/mean.js';


/**
 * A fork-to-fork/leaf skeleton stretch cut DIRECTLY from the MAT - no
 * fat-branch provenance, no rooting; direction is walk-derived (arbitrary
 * but fixed).
 */
interface MatSegment {
    readonly v0: number;
    readonly v1: number;
    /** skeleton beziers, v0 → v1 */
    readonly pss: number[][][];
    /** maximal-disk radius per bezier knot (`pss.length + 1` values) */
    readonly radii: number[];
    /** arc length of the segment's skeleton */
    readonly len: number;
    /** skeleton material 2·r̄·len in RAW area units */
    readonly material: number;
    /** boundary pieces alongside each skeleton edge (`pss.length` entries),
     *  per side, each in outline direction (`out` runs with the segment) */
    readonly sleeves: readonly { out: number[][][]; back: number[][][] }[];
}

interface MatSegGraph {
    readonly vertices: SegVertex[];
    readonly segments: MatSegment[];
}


/** One skeleton edge's two boundary-side occurrences. */
interface MatEdge {
    /** circle ids in `cpA`'s travel direction */
    readonly from: number;
    readonly to: number;
    readonly cpA: CpNode;
    /** the opposite-side occurrence (walks `to` → `from`) */
    cpB?: CpNode;
}


/**
 * Builds the segment graph directly from the MAT: one full outline walk
 * collects every skeleton edge's two boundary-side occurrences (keyed by
 * circle-id pair; same-circle steps = leaf-tip caps, not edges), then the
 * edge graph is cut at every non-degree-2 circle (forks + leaf tips).
 * Rooting-free - unlike `segGraphOf` no fat-branch tree is involved.
 */
function segGraphFromMat(start: CpNode): MatSegGraph {

    const edges = new Map<string, MatEdge>();
    /** incident edge keys per circle id */
    const adj = new Map<number, string[]>();
    /** circle ids in first-encounter order (deterministic output) */
    const circleOrder: number[] = [];

    const addAdj = (c: number, key: string): void => {
        let list = adj.get(c);
        if (list === undefined) {
            adj.set(c, list = []);
            circleOrder.push(c);
        }
        list.push(key);
    };

    let cp = start;
    do {
        const from = getCircleId(cp);
        const to = getCircleId(cp.next);
        // same-circle steps (leaf-tip caps) are not skeleton edges
        if (from !== to) {
            const key = from < to ? `${from}_${to}` : `${to}_${from}`;
            const e = edges.get(key);
            if (e === undefined) {
                edges.set(key, { from, to, cpA: cp });
                addAdj(from, key);
                addAdj(to, key);
            } else {
                e.cpB = cp;
            }
        }
        cp = cp.next;
    } while (cp !== start);

    const vertices: SegVertex[] = [];
    const vertexOf = new Map<number, number>();
    const segments: MatSegment[] = [];
    const visited = new Set<string>();

    const isVertexCircle = (c: number): boolean =>
        adj.get(c)!.length !== 2;

    const vertexFor = (c: number, p: number[]): number => {
        let v = vertexOf.get(c);
        if (v === undefined) {
            v = vertices.length;
            vertices.push({ id: v, p });
            vertexOf.set(c, v);
        }
        return v;
    };

    for (const c0 of circleOrder) {
        if (!isVertexCircle(c0)) { continue; }
        for (const key0 of adj.get(c0)!) {
            if (visited.has(key0)) { continue; }

            // walk through pass-through (degree-2) circles to the next
            // fork/leaf circle
            const pss: number[][][] = [];
            const radii: number[] = [];
            const sleeves: { out: number[][][]; back: number[][][] }[] = [];
            let cur = c0;
            let key = key0;
            for (;;) {
                visited.add(key);
                const e = edges.get(key)!;
                const withCp = e.from === cur ? e.cpA : e.cpB!;
                const backCp = e.from === cur ? e.cpB! : e.cpA;

                if (radii.length === 0) {
                    radii.push(withCp.pointOnShape.circle.radius);
                }
                radii.push(withCp.next.pointOnShape.circle.radius);
                pss.push(getMatCurveToNext(withCp));
                sleeves.push({
                    out: getBoundaryBeziersToNext(withCp),
                    back: getBoundaryBeziersToNext(backCp)
                });

                cur = e.from === cur ? e.to : e.from;
                if (isVertexCircle(cur)) { break; }
                key = adj.get(cur)!.find(k => k !== key)!;
            }

            const lastPs = pss[pss.length - 1];
            const len = sum(pss.map(totalLength$));
            segments.push({
                v0: vertexFor(c0, pss[0][0]),
                v1: vertexFor(cur, lastPs[lastPs.length - 1]),
                pss,
                radii,
                len,
                material: 2*mean(radii)*len,
                sleeves
            });
        }
    }

    return { vertices, segments };
}


export { segGraphFromMat }
export type { MatSegGraph, MatSegment }
