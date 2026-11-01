import type { Pose } from '../procrustes/pose.js';
import { munkres } from 'munkres-ts';
import { calcProcrustes$ } from '../procrustes/calc-procrustes.js';

const { abs, hypot, log, min, sin, sqrt } = Math;


/** The weights of a pair's mismatch terms (`calcPairCost`). */
interface PairWeights {
    /** position mismatch weight (per frame-scale unit of centroid offset) */
    readonly pos: number;
    /** size mismatch weight (per unit of log size-fraction ratio) */
    readonly size: number;
    /** shape mismatch weight (anisotropy and principal axis) */
    readonly shape: number;
}


/** the pair weights of components */
const COMPONENT_WEIGHTS: PairWeights = { pos: 2, size: 1, shape: 0.5 };
/** the cost of leaving one component unmatched (it shrinks to a point) */
const DROP_COST = 1;
/** an unavailable cell (finite - Munkres subtracts, `Infinity` would NaN) */
const BLOCKED = 1e9;


/**
 * How the components (or the holes of a component pair) of two glyphs
 * correspond.
 */
interface ComponentMatch {
    /** matched pairs `[i, j]`: item `i` of A with item `j` of B */
    readonly pairs: [number, number][];
    /** A's items without a partner */
    readonly onlyA: number[];
    /** B's items without a partner */
    readonly onlyB: number[];
}


/**
 * A component's pose relative to its glyph (or a hole's relative to its
 * component).
 */
interface RelPose {
    /** centroid offset from the frame's centroid, in the frame's scale */
    readonly pos: number[];
    /** its share of the frame's scale (√area fraction) */
    readonly size: number;
    readonly angle: number;
    readonly anisotropy: number;
}


/**
 * Returns how the components (one outline loop each) of glyph A correspond
 * to those of glyph B: the cheapest one-to-one assignment (Munkres), where
 * any component may instead stay unmatched.
 *
 * * each component is described relative to its own glyph (`calcRelPoses`)
 *   - its centroid offset from the glyph's centroid and its size, both in
 *   the glyph's scale, plus its principal axis - so glyphs of different
 *   sizes compare
 *
 * * a pair costs its position, size and shape mismatch (`calcPairCost`);
 *   leaving a component unmatched costs `DROP_COST` (`assignWithDrops`)
 *
 * @param loopsA glyph A's components' outline loops
 * @param loopsB glyph B's components' outline loops
 */
function matchComponents(
        loopsA: number[][][][],
        loopsB: number[][][][]): ComponentMatch {

    const dropsA = loopsA.map(() => DROP_COST);
    const dropsB = loopsB.map(() => DROP_COST);
    if (loopsA.length === 0 || loopsB.length === 0) {
        return assignWithDrops([], dropsA, dropsB);
    }

    const relsA = calcRelPoses(loopsA.map(l => calcProcrustes$(l)));
    const relsB = calcRelPoses(loopsB.map(l => calcProcrustes$(l)));

    const costs = relsA.map(a => relsB.map(b =>
        calcPairCost(a, b, COMPONENT_WEIGHTS)));

    return assignWithDrops(costs, dropsA, dropsB);
}


/**
 * Returns the cheapest one-to-one assignment (Munkres) of A's items to B's
 * items, where any item may instead stay unmatched at its drop cost.
 *
 * * the assignment is over the square matrix padded with one dummy per
 *   item of the other side (a dummy taken is a drop), so the drops compete
 *   with the matches in the same optimum
 *
 * @param costs the pair costs (A's items × B's items)
 * @param dropsA the cost of leaving each of A's items unmatched
 * @param dropsB the cost of leaving each of B's items unmatched
 */
function assignWithDrops(
        costs: number[][],
        dropsA: number[],
        dropsB: number[]): ComponentMatch {

    const nA = dropsA.length;
    const nB = dropsB.length;
    if (nA === 0 || nB === 0) {
        return {
            pairs: [],
            onlyA: Array.from({ length: nA }, (_, i) => i),
            onlyB: Array.from({ length: nB }, (_, j) => j)
        };
    }

    // rows: A's items, then B's dummies; columns: B's items, then A's
    // dummies - a dummy is only available to its own item
    const n = nA + nB;
    const C: number[][] = [];
    for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let j = 0; j < n; j++) {
            row.push(
                i < nA && j < nB ? costs[i][j]
                : i < nA ? (j - nB === i ? dropsA[i] : BLOCKED)
                : j < nB ? (i - nA === j ? dropsB[j] : BLOCKED)
                : 0
            );
        }
        C.push(row);
    }

    const cols = munkres(C);

    const pairs: [number, number][] = [];
    const onlyA: number[] = [];
    for (let i = 0; i < nA; i++) {
        const j = cols[i];
        if (j < nB) { pairs.push([i, j]); } else { onlyA.push(i); }
    }
    const matchedB = new Set(pairs.map(([, j]) => j));
    const onlyB = Array.from({ length: nB }, (_, j) => j)
        .filter(j => !matchedB.has(j));

    return { pairs, onlyA, onlyB };
}


/**
 * Returns the components' poses relative to their glyph: the glyph's
 * centroid is the area-weighted mean of the components' centroids and its
 * scale the √ of their total area.
 *
 * @param poses the components' poses
 */
function calcRelPoses(poses: Pose[]): RelPose[] {
    const areas = poses.map(p => p.scale**2);
    const total = areas.reduce((s, a) => s + a, 0);
    const S = sqrt(total);

    let gx = 0;
    let gy = 0;
    for (let k = 0; k < poses.length; k++) {
        const [x, y] = poses[k].centroid;
        gx += areas[k]*x/total;
        gy += areas[k]*y/total;
    }

    return poses.map(p => calcRelPose(p, [gx, gy], S));
}


/**
 * Returns a pose relative to a frame: its centroid's offset from the
 * frame's centroid and its scale, both in the frame's scale.
 *
 * @param pose the pose
 * @param centroid the frame's centroid
 * @param S the frame's scale
 */
function calcRelPose(
        pose: Pose,
        centroid: number[],
        S: number): RelPose {

    const { centroid: [x, y], scale, angle, anisotropy } = pose;
    const [gx, gy] = centroid;

    return {
        pos: [(x - gx)/S, (y - gy)/S],
        size: scale/S,
        angle,
        anisotropy
    };
}


/**
 * Returns the cost of matching component `a` with component `b` (or two
 * holes), the weighted sum of:
 *
 * * position: the distance between their frame-relative centroids
 *
 * * size: the log ratio of their frame-relative sizes
 *
 * * shape: the difference of their anisotropies, plus the angle between
 *   their principal axes - counted only as far as both axes are measurable
 *   (the smaller anisotropy)
 *
 * @param a the item of A
 * @param b the item of B
 * @param weights the terms' weights
 */
function calcPairCost(
        a: RelPose,
        b: RelPose,
        weights: PairWeights): number {

    const { pos: pA, size: sA, angle: θA, anisotropy: anA } = a;
    const { pos: pB, size: sB, angle: θB, anisotropy: anB } = b;
    const { pos: wPos, size: wSize, shape: wShape } = weights;

    const posCost = hypot(pA[0] - pB[0], pA[1] - pB[1]);
    const sizeCost = abs(log(sA/sB));
    const shapeCost = abs(anA - anB) +
        min(anA, anB)*abs(sin(θA - θB));

    return wPos*posCost + wSize*sizeCost + wShape*shapeCost;
}


export { matchComponents, assignWithDrops, calcRelPose, calcPairCost }
export type { ComponentMatch, RelPose, PairWeights }
