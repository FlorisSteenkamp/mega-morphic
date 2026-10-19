import type { Circle } from 'flo-mat';
import type { Glue, MorphEntry } from './morph-entry.js';
import type { Segment } from './segment-tree/segment.js';
import { composeSeg } from './segment-tree/compose-segs.js';
import { geomOf$ } from './segment-tree/geom-of.js';
import { buildSleeveSides } from './anchored-sleeves.js';
import { calcSkelCumKnots } from './fs/skeleton-knots.js';
import { getLastP } from './fs/get-last-p.js';
import { boundaries } from './fs/boundaries.js';
import { nearestIdx } from './nearest-idx.js';
import { squaredDistanceBetween } from 'flo-vector2d';

const { min } = Math;


/**
 * Places a collapsed entry for every segment no matched route covers,
 * closest-to-coverage first: the segment collapses onto its junction (the
 * vertex on its coverage side - skeleton, radii and boundary sleeves all
 * degenerate to that point in the other frame) while its glue keeps the
 * junction riding the owning entry's drawn boundary throughout the morph.
 * Chained uncovered segments glue to the (already placed) neighbor's entry
 * the same way. `side` is the tree's own frame ('a' = shape 1 for
 * deleted, 'b' = shape 2 for inserted).
 */
function placeTopology(
        g: Segment[],
        /** segments covered by some matched route (this side) */
        covered: Set<Segment>,
        /** covered segment → its entry index; gains placed segments */
        owner: Map<Segment, number>,
        side: 'a' | 'b',
        classes: string,
        capSign: number,
        entries: MorphEntry[]): void {

    /** a segment's two end vertices */
    const endsOf = (s: Segment): [Circle, Circle] => {
        const { vertS, vertE } = geomOf$(s);
        return [vertS, vertE];
    };

    const adj = new Map<Circle, Segment[]>();
    for (const s of g) {
        for (const v of endsOf(s)) {
            adj.getOrInsert(v, []).push(s);
        }
    }

    // BFS hop distance from the covered region (matched routes form a
    // connected subtree, so every vertex is reached)
    const dist = new Map<Circle, number>();
    const queue: Circle[] = [];
    for (const s of covered) {
        for (const v of endsOf(s)) {
            if (!dist.has(v)) { dist.set(v, 0); queue.push(v); }
        }
    }
    for (let qi = 0; qi < queue.length; qi++) {
        const v = queue[qi];
        const d = dist.get(v)!;
        for (const s of adj.get(v) ?? []) {
            if (covered.has(s)) { continue; }
            const [vS, vE] = endsOf(s);
            const w = vS === v ? vE : vS;
            if (!dist.has(w)) { dist.set(w, d + 1); queue.push(w); }
        }
    }

    const dOf = (s: Segment): number => {
        const [vS, vE] = endsOf(s);
        return min(dist.get(vS) ?? Infinity, dist.get(vE) ?? Infinity);
    };

    // closer-to-coverage first: a segment's coverage-side neighbors are
    // already placed when it is (chained glue)
    const pending = g
        .filter(s => !covered.has(s) && dOf(s) < Infinity)
        .sort((x, y) => dOf(x) - dOf(y));

    for (const seg of pending) { place(seg); }

    function place(seg: Segment): void {
        const [vS, vE] = endsOf(seg);
        const d0 = dist.get(vS) ?? Infinity;
        const d1 = dist.get(vE) ?? Infinity;
        // junction = the coverage-side vertex (collapse target)
        const jV = d0 <= d1 ? vS : vE;

        // junction LAST (pushCollapsedEntry collapses onto the last point)
        const { skelPss: bz, radii, sleeves } = composeSeg(seg, vS === jV);

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
            // candidates are always real on this side (matched entries,
            // or topology entries of this same side)
            const { skelPssA, skelPssB } = entries[e];
            const bn = boundaries(side === 'a' ? skelPssA : skelPssB);
            const k = nearestIdx(bn, junction);
            const d = squaredDistanceBetween(bn[k], junction);
            if (d < bestD) { bestD = d; bestAt = { e, k }; }
        }
        if (bestAt === undefined) { return; }

        const glue: Glue = { e: bestAt.e, k1: bestAt.k, k2: bestAt.k };

        owner.set(seg, pushCollapsedEntry(
            bz, junction, radii, sleeves, side, classes, capSign, glue, entries));
    }
}


/**
 * Pushes a topology entry: the real geometry in its own frame, collapsed
 * onto its junction (last point) with zero radii and point sleeves in the
 * other frame. Returns the entry index.
 *
 * @param junction `bz`'s last point
 */
function pushCollapsedEntry(
        bz: number[][][],
        junction: number[],
        radii: number[],
        sleeves: readonly { out: number[][][]; back: number[][][] }[],
        side: 'a' | 'b',
        classes: string,
        capSign: number,
        glue: Glue,
        entries: MorphEntry[]): number {

    const collapsed = collapseTo(bz, junction);
    // Radii → 0 so the branch's disks vanish into the fork disk
    // (pinning them to the fork radius made tip disks GROW).
    const rZero = radii.map(() => 0);

    // No resampling needed: the collapsed frame mirrors the real frame
    // segment for segment, so both use the real frame's knots.
    const us = calcSkelCumKnots(bz);
    const pointSleeves = sleeves.map(() => ({
        out: [[junction, junction]],
        back: [[junction, junction]]
    }));

    const real = { sleeves, knots: us, us, bz, radii };
    const gone = {
        sleeves: pointSleeves, knots: us, us, bz: collapsed, radii: rZero
    };

    const sides = side === 'a'
        ? buildSleeveSides(real, gone)
        : buildSleeveSides(gone, real);

    const idx = entries.length;
    entries.push({
        skelPssA: side === 'a' ? bz : collapsed,
        skelPssB: side === 'a' ? collapsed : bz,
        ra: side === 'a' ? radii : rZero,
        rb: side === 'a' ? rZero : radii,
        sleeveOut: sides.out,
        sleeveBack: sides.back,
        capSign,
        classes,
        glue,
        collapsed: side === 'a' ? 'b' : 'a'
    });

    return idx;
}


function collapseTo(beziers: number[][][], pt: number[]): number[][][] {
    return beziers.map(ps => ps.map(() => [pt[0], pt[1]]));
}


export { placeTopology }
