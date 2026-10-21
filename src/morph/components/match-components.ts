import type { Pose } from '../procrustes/pose.js';
import { munkres } from 'munkres-ts';
import { calcProcrustes$ } from '../procrustes/calc-procrustes.js';

const { abs, hypot, log, min, sin, sqrt } = Math;


/** position mismatch weight (per glyph-scale unit of centroid offset) */
const W_POS = 2;
/** size mismatch weight (per unit of log size-fraction ratio) */
const W_SIZE = 1;
/** shape mismatch weight (anisotropy and principal axis) */
const W_SHAPE = 0.5;
/** the cost of leaving one component unmatched (it shrinks to a point) */
const DROP_COST = 1;
/** an unavailable cell (finite - Munkres subtracts, `Infinity` would NaN) */
const BLOCKED = 1e9;


/** How the components of two glyphs correspond. */
interface ComponentMatch {
    /** matched pairs `[i, j]`: component `i` of A with component `j` of B */
    readonly pairs: [number, number][];
    /** A's components without a partner */
    readonly onlyA: number[];
    /** B's components without a partner */
    readonly onlyB: number[];
}


/** A component's pose relative to its glyph. */
interface RelPose {
    /** centroid offset from the glyph's centroid, in glyph scale units */
    readonly pos: number[];
    /** the component's share of the glyph's scale (√area fraction) */
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
 *   leaving a component unmatched costs `DROP_COST`
 *
 * * the assignment is over the square matrix padded with one dummy per
 *   component of the other glyph (a dummy taken is a drop), so the drops
 *   compete with the matches in the same optimum
 *
 * @param loopsA glyph A's components' outline loops
 * @param loopsB glyph B's components' outline loops
 */
function matchComponents(
        loopsA: number[][][][],
        loopsB: number[][][][]): ComponentMatch {

    const nA = loopsA.length;
    const nB = loopsB.length;
    const n = nA + nB;
    if (nA === 0 || nB === 0) {
        return {
            pairs: [],
            onlyA: loopsA.map((_, i) => i),
            onlyB: loopsB.map((_, j) => j)
        };
    }

    const relsA = calcRelPoses(loopsA.map(l => calcProcrustes$(l)));
    const relsB = calcRelPoses(loopsB.map(l => calcProcrustes$(l)));

    // rows: A's components, then B's dummies; columns: B's components, then
    // A's dummies - a dummy is only available to its own component
    const C: number[][] = [];
    for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let j = 0; j < n; j++) {
            row.push(
                i < nA && j < nB ? calcPairCost(relsA[i], relsB[j])
                : i < nA ? (j - nB === i ? DROP_COST : BLOCKED)
                : j < nB ? (i - nA === j ? DROP_COST : BLOCKED)
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
    const onlyB = loopsB.map((_, j) => j).filter(j => !matchedB.has(j));

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

    return poses.map(p => {
        const { centroid: [x, y], scale, angle, anisotropy } = p;

        return {
            pos: [(x - gx)/S, (y - gy)/S],
            size: scale/S,
            angle,
            anisotropy
        };
    });
}


/**
 * Returns the cost of matching component `a` with component `b`:
 *
 * * position: the distance between their glyph-relative centroids
 *
 * * size: the log ratio of their glyph-relative sizes
 *
 * * shape: the difference of their anisotropies, plus the angle between
 *   their principal axes - counted only as far as both axes are measurable
 *   (the smaller anisotropy)
 */
function calcPairCost(
        a: RelPose,
        b: RelPose): number {

    const { pos: pA, size: sA, angle: θA, anisotropy: anA } = a;
    const { pos: pB, size: sB, angle: θB, anisotropy: anB } = b;

    const posCost = hypot(pA[0] - pB[0], pA[1] - pB[1]);
    const sizeCost = abs(log(sA/sB));
    const shapeCost = abs(anA - anB) +
        min(anA, anB)*abs(sin(θA - θB));

    return W_POS*posCost + W_SIZE*sizeCost + W_SHAPE*shapeCost;
}


export { matchComponents }
export type { ComponentMatch }
