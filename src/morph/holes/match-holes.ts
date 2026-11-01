import type { CpNode } from 'flo-mat';
import type { ComponentMatch, RelPose, PairWeights } from '../components/match-components.js';
import type { ComponentLoops } from './get-component-loops.js';
import { matchComponents, assignWithDrops, calcRelPose, calcPairCost } from '../components/match-components.js';
import { calcProcrustes$ } from '../procrustes/calc-procrustes.js';
import { outlineLoopOf } from '../segment-tree/outline-loop.js';
import { getComponentLoops } from './get-component-loops.js';


/**
 * the pair weights of holes - position counts half as much as for
 * components: a hole sliding within its outline is a natural morph, a
 * component moving across the glyph is a different part of it
 */
const HOLE_WEIGHTS: PairWeights = { pos: 1, size: 1, shape: 0.5 };
/**
 * the cost of leaving one hole unmatched - flat, so a pair is kept iff its
 * cost is below twice this (with one hole a side; in general the assignment
 * is optimal with that rule built in)
 *
 * * an unmatched hole isn't lost - it morphs as part of its component's
 *   tree, cut open at its hole-closer - so a big hole needn't cost more to
 *   leave unmatched than a small one
 */
const HOLE_DROP_COST = 0.8;


/** How the holes of a matched component pair correspond. */
interface HolePairMatch {
    /** the component of A */
    readonly compA: number;
    /** the component of B */
    readonly compB: number;
    /** A's component's loops */
    readonly loopsA: ComponentLoops;
    /** B's component's loops */
    readonly loopsB: ComponentLoops;
    /** the hole pair costs (A's holes × B's holes) */
    readonly costs: number[][];
    /** the cost of leaving each of A's holes unmatched */
    readonly dropsA: number[];
    /** the cost of leaving each of B's holes unmatched */
    readonly dropsB: number[];
    /** the holes' correspondence (indices into the `holes`) */
    readonly match: ComponentMatch;
}


/**
 * Returns how the holes of glyph A correspond to those of glyph B, per
 * matched component pair.
 *
 * * the components are matched as the morph matches them
 *   (`matchComponents`), and a hole only pairs with a hole of its
 *   component's partner - the holes of a component without a partner go
 *   with it
 *
 * * per component pair the holes are matched by `matchHoles`
 *
 * @param cpsA a `CpNode` per component (MAT) of glyph A
 * @param cpsB a `CpNode` per component (MAT) of glyph B
 */
function matchGlyphHoles(
        cpsA: CpNode[],
        cpsB: CpNode[]): HolePairMatch[] {

    const { pairs } = matchComponents(
        cpsA.map(outlineLoopOf), cpsB.map(outlineLoopOf));

    return pairs.map(([i, j]) => {
        const loopsA = getComponentLoops(cpsA[i]);
        const loopsB = getComponentLoops(cpsB[j]);

        return { compA: i, compB: j, loopsA, loopsB, ...matchHoles(loopsA, loopsB) };
    });
}


/**
 * Returns the hole pair and drop costs and the holes' correspondence of a
 * component pair: the cheapest one-to-one assignment, where any hole may
 * instead stay unmatched - a hole pair is a priced choice, never forced.
 *
 * * each hole is described relative to its component's outer loop
 *   (`calcHoleRelPoses`), so a component's only hole is still placed and
 *   sized - not trivially centered at full size
 *
 * * a pair costs its position, size and shape mismatch, as a component
 *   pair does (`calcPairCost`), but weighted by `HOLE_WEIGHTS`
 *
 * * leaving a hole unmatched costs `HOLE_DROP_COST`
 *
 * @param loopsA A's component's loops
 * @param loopsB B's component's loops
 */
function matchHoles(
        loopsA: ComponentLoops,
        loopsB: ComponentLoops) {

    const relsA = calcHoleRelPoses(loopsA);
    const relsB = calcHoleRelPoses(loopsB);

    const costs = relsA.map(a => relsB.map(b =>
        calcPairCost(a, b, HOLE_WEIGHTS)));
    const dropsA = relsA.map(() => HOLE_DROP_COST);
    const dropsB = relsB.map(() => HOLE_DROP_COST);
    const match = assignWithDrops(costs, dropsA, dropsB);

    return { costs, dropsA, dropsB, match };
}


/**
 * Returns the component's holes' poses relative to its outer loop (the
 * filled silhouette - its frame is then independent of the holes).
 */
function calcHoleRelPoses(
        loops: ComponentLoops): RelPose[] {

    const { outer, holes } = loops;
    const { centroid, scale } = calcProcrustes$(outer);

    return holes.map(h => calcRelPose(calcProcrustes$(h), centroid, scale));
}


export { matchGlyphHoles, matchHoles }
export type { HolePairMatch }
