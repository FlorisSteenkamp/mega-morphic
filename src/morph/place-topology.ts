import type { Glue, MutableMorphEntry } from './morph-entry.js';
import type { Segment } from './segment-graph/segment.js';
import type { SegGraph } from './segment-graph/seg-graph.js';
import { composeSegs } from './segment-graph/compose-segs.js';
import { buildSleeveSides, skeletonKnots } from './anchored-sleeves.js';
import { getLastP } from './fs/get-last-p.js';
import { nearestIdx } from './nearest-idx.js';

const { min, hypot } = Math;


/**
 * Places a collapsed entry for every segment no matched route covers,
 * closest-to-coverage first: the segment collapses onto its junction (the
 * vertex on its coverage side - skeleton, radii and boundary sleeves all
 * degenerate to that point in the other frame) while its glue keeps the
 * junction riding the owning entry's drawn boundary throughout the morph.
 * Chained uncovered segments glue to the (already placed) neighbor's entry
 * the same way. `side` is the graph's own frame ('a' = shape 1 for
 * deleted, 'b' = shape 2 for inserted).
 */
function placeTopology(
        g: SegGraph,
        /** segments covered by some matched route (this side) */
        covered: Set<Segment>,
        /** covered segment → its entry index; gains placed segments */
        owner: Map<Segment, number>,
        side: 'a' | 'b',
        classes: string,
        capSign: number,
        bnds: { a?: number[][]; b?: number[][] }[],
        entries: MutableMorphEntry[],
        /** attachment-point dot marks (own frame) */
        marks?: { pA?: number[]; pB?: number[]; classes: string;
            dot?: boolean;
            at?: { e: number; k1: number; k2: number } }[]): void {

    const adj = new Map<number, Segment[]>();
    for (const s of g.segments) {
        for (const v of [s.vertIdS, s.vertIdE]) {
            let list = adj.get(v);
            if (list === undefined) { adj.set(v, list = []); }
            list.push(s);
        }
    }

    // BFS hop distance from the covered region (matched routes form a
    // connected subtree, so every vertex is reached)
    const dist = new Map<number, number>();
    const queue: number[] = [];
    for (const s of covered) {
        for (const v of [s.vertIdS, s.vertIdE]) {
            if (!dist.has(v)) { dist.set(v, 0); queue.push(v); }
        }
    }
    for (let qi = 0; qi < queue.length; qi++) {
        const v = queue[qi];
        const d = dist.get(v)!;
        for (const s of adj.get(v) ?? []) {
            if (covered.has(s)) { continue; }
            const w = s.vertIdS === v ? s.vertIdE : s.vertIdS;
            if (!dist.has(w)) { dist.set(w, d + 1); queue.push(w); }
        }
    }

    const dOf = (s: Segment): number =>
        min(dist.get(s.vertIdS) ?? Infinity, dist.get(s.vertIdE) ?? Infinity);

    // closer-to-coverage first: a segment's coverage-side neighbors are
    // already placed when it is (chained glue)
    const pending = g.segments
        .filter(s => !covered.has(s) && dOf(s) < Infinity)
        .sort((x, y) => dOf(x) - dOf(y));

    for (const seg of pending) { place(seg); }

    function place(seg: Segment): void {
        const d0 = dist.get(seg.vertIdS) ?? Infinity;
        const d1 = dist.get(seg.vertIdE) ?? Infinity;
        // junction = the coverage-side vertex (collapse target)
        const jV = d0 <= d1 ? seg.vertIdS : seg.vertIdE;

        // junction LAST (pushCollapsedEntry collapses onto the last point)
        const { bz, rd: radii, edges } = composeSegs([seg], seg.vertIdS === jV);

        const junction = getLastP(bz);

        // glue candidates: entries owning a junction-incident segment -
        // matched entries first, then earlier-placed neighbors (ties on
        // boundary distance prefer matched)
        const candidateEs: number[] = [];
        for (const coveredFirst of [true, false]) {
            for (const t of adj.get(jV) ?? []) {
                const e = owner.get(t);
                if (t !== seg && e !== undefined &&
                    covered.has(t) === coveredFirst) {
                    candidateEs.push(e);
                }
            }
        }

        let bestAt: { e: number; k: number } | undefined;
        let bestD = Infinity;
        for (const e of candidateEs) {
            const bn = bnds[e][side];
            if (bn === undefined) { continue; }
            const k = nearestIdx(bn, junction);
            const d = hypot(
                bn[k][0] - junction[0], bn[k][1] - junction[1]);
            if (d < bestD) { bestD = d; bestAt = { e, k }; }
        }
        if (bestAt === undefined) { return; }

        const glue: Glue = {
            e1: bestAt.e, k1: bestAt.k,
            e2: bestAt.e, k2: bestAt.k
        };

        const bnAt = bnds[bestAt.e][side]![bestAt.k];
        marks?.push({
            [side === 'a' ? 'pA' : 'pB']: bnAt,
            classes: `${side === 'a' ? 'red' : 'green'} nostroke`,
            dot: true,
            at: { e: bestAt.e, k1: bestAt.k, k2: bestAt.k }
        });

        owner.set(seg, pushCollapsedEntry(
            bz, radii, edges, side, classes, capSign, glue,
            bnds, entries));
    }
}


/**
 * Pushes a topology entry: the real geometry in its own frame, collapsed
 * onto its junction (last point) with zero radii and point sleeves in the
 * other frame. Returns the entry index.
 */
function pushCollapsedEntry(
        bz: number[][][],
        radii: number[],
        edges: { out: number[][][]; back: number[][][] }[],
        side: 'a' | 'b',
        classes: string,
        capSign: number,
        glue: Glue,
        bnds: { a?: number[][]; b?: number[][] }[],
        entries: MutableMorphEntry[]): number {

    const junction = getLastP(bz);

    const collapsed = collapseTo(bz, junction);
    // Radii → 0 so the branch's disks vanish into the fork disk
    // (pinning them to the fork radius made tip disks GROW).
    const rZero = radii.map(() => 0);

    // No resampling needed: the collapsed frame mirrors the real frame
    // segment for segment, so both use the real frame's knots.
    const us = skeletonKnots(bz);
    const pointEdges = edges.map(() => ({
        out: [[junction, junction]],
        back: [[junction, junction]]
    }));

    const real = { edges, knots: us, us, bz, radii };
    const gone = {
        edges: pointEdges, knots: us, us, bz: collapsed, radii: rZero
    };

    const sides = side === 'a'
        ? buildSleeveSides(real, gone)
        : buildSleeveSides(gone, real);

    const idx = entries.length;
    bnds.push(side === 'a' ? { a: boundaries(bz) } : { b: boundaries(bz) });
    entries.push({
        skelPssA: side === 'a' ? bz : collapsed,
        skelPssB: side === 'a' ? collapsed : bz,
        ra: side === 'a' ? radii : rZero,
        rb: side === 'a' ? rZero : radii,
        us,
        sleeveOut: sides.out,
        sleeveBack: sides.back,
        capSign,
        classes,
        glue,
        collapsed: side === 'a' ? 'b' : 'a'
    });

    return idx;
}


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]): number[][] {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


function collapseTo(beziers: number[][][], pt: number[]): number[][][] {
    return beziers.map(ps => ps.map(() => [pt[0], pt[1]]));
}


export { placeTopology, pushCollapsedEntry }
