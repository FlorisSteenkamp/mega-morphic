import type { Circle } from 'flo-mat';
import type { Segment } from '../segment.js';
import type { Ranked } from './ranked.js';
import { adjOf$ } from '../adj-of.js';
import { geomOf$ } from '../geom-of.js';


/**
 * Returns a trunk leader together with its end variants, all priced alike.
 *
 * * where the leader's route ends disagree in kind - a fork in one glyph,
 *   a leaf in the other - the fork end may instead extend into one of its
 *   short terminal tips (`calcEndAlts`), or the leaf end retract to its fork
 *   if it is such a tip: the DTW decides that choice on a near-tie (a tiny
 *   tip is about as cheap to align as to skip), while the full recursion,
 *   which sees the children, can tell which way the two glyphs correspond
 *
 * * a variant keeps its source's rank; every route pair (the leader's too,
 *   when it has variants) is priced by `costsOf`, so they compare like with
 *   like - variants that can't be priced are left out
 *
 * * without disagreeing ends, just the leader
 *
 * @param l the trunk leader
 * @param gA tree A's segments
 * @param gB tree B's segments
 * @param costsOf the shape and sway costs of the route pair startA → endA ↔
 * startB → endB (`undefined` if they can't be aligned)
 */
function endVariantsOf(
        l: Ranked,
        gA: Segment[],
        gB: Segment[],
        costsOf: (
            startA: Circle,
            endA: Circle,
            startB: Circle,
            endB: Circle) => { shapeCost: number; swayCost: number } | undefined
        ): Ranked[] {

    const { c } = l;
    const starts = calcEndPairs(gA, gB, c.startA, c.startB);
    const ends = calcEndPairs(gA, gB, c.endA, c.endB);
    if (starts.length === 1 && ends.length === 1) { return [l]; }

    const out: Ranked[] = [];
    for (const [startA, startB] of starts) {
        for (const [endA, endB] of ends) {
            if (startA === endA || startB === endB) { continue; }
            const costs = costsOf(startA, endA, startB, endB);
            if (costs === undefined) { continue; }

            out.push({
                ...l,
                c: { ...c, startA, startB, endA, endB, ...costs }
            });
        }
    }

    return out;
}


/**
 * Returns the route end pairs to try in place of `(vA, vB)`: the pair
 * itself, plus - when one is a fork and the other a leaf - each alternative
 * of either end (`calcEndAlts`) paired with the other end as is.
 *
 * @param gA tree A's segments
 * @param gB tree B's segments
 * @param vA the end in A
 * @param vB the end in B
 */
function calcEndPairs(
        gA: Segment[],
        gB: Segment[],
        vA: Circle,
        vB: Circle): [Circle, Circle][] {

    const isLeafA = adjOf$(gA).get(vA)!.length === 1;
    const isLeafB = adjOf$(gB).get(vB)!.length === 1;

    const pairs: [Circle, Circle][] = [[vA, vB]];
    if (isLeafA === isLeafB) { return pairs; }

    for (const a of calcEndAlts(gA, vA)) { pairs.push([a, vB]); }
    for (const b of calcEndAlts(gB, vB)) { pairs.push([vA, b]); }

    return pairs;
}


/**
 * Returns the alternative route ends for `v` across a short terminal tip -
 * a single segment between a fork and a leaf, no longer than twice the
 * fork's radius (a serif tip):
 *
 * * `v` a fork: the leaves of its short tips
 *
 * * `v` a leaf at the end of a short tip: the tip's fork
 *
 * @param g the tree's segments
 * @param v the route end
 */
function calcEndAlts(
        g: Segment[],
        v: Circle): Circle[] {

    const adj = adjOf$(g);
    const segs = adj.get(v)!;

    const out: Circle[] = [];
    for (const s of segs) {
        const { vertS, vertE, skelLen } = geomOf$(s);
        const u = vertS === v ? vertE : vertS;
        const degV = segs.length;
        const degU = adj.get(u)!.length;

        const fork = degV >= 3 && degU === 1 ? v
            : degV === 1 && degU >= 3 ? u
            : undefined;
        if (fork !== undefined && skelLen <= 2*fork.radius) { out.push(u); }
    }

    return out;
}


export { endVariantsOf }
