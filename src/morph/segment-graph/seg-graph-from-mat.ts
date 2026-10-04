import type { CpNode } from 'flo-mat';
import type { SegVertex } from './seg-vertex.js';
import type { Segment } from './segment.js';
import type { SegGraph } from './seg-graph.js';
import { getMatCurveToNext, getBoundaryBeziersToNext, getAllOnCircle } from 'flo-mat';
import { outlineLoopOf } from './outline-loop.js';
import { mean } from '../../utils/mean.js';
import { lenOf$ } from './len-of.js';

const { min } = Math;


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
 * Rooting-free - no fat-branch tree is involved; segment direction is
 * walk-derived (arbitrary but fixed).
 */
function segGraphFromCp(
        cpStart: CpNode): SegGraph {

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

    let cp = cpStart;
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
    } while (cp !== cpStart);

    const loop = outlineLoopOf(cpStart);

    const vertices: SegVertex[] = [];
    const vertexOf = new Map<number, number>();
    const segments: Segment[] = [];
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
            const skelPss: number[][][] = [];
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
                skelPss.push(getMatCurveToNext(withCp));
                sleeves.push({
                    out: getBoundaryBeziersToNext(withCp),
                    back: getBoundaryBeziersToNext(backCp)
                });

                cur = e.from === cur ? e.to : e.from;
                if (isVertexCircle(cur)) { break; }
                key = adj.get(cur)!.find(k => k !== key)!;
            }

            const lastPs = skelPss[skelPss.length - 1];
            const len = lenOf$(skelPss);

            segments.push({
                vertIdS: vertexFor(c0, skelPss[0][0]),
                vertIdE: vertexFor(cur, lastPs[lastPs.length - 1]),
                skelPss,
                radii,
                material: 2*mean(radii)*len,
                sleeves
            });
        }
    }

    return { loop, vertices, segments };
}


function getCircleId(cp: CpNode): number {
    return min(...getAllOnCircle(cp).map(c => c.id));
}


export { segGraphFromCp }
