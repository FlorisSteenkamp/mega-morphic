declare var _debug_: Debug; 
import type { Debug } from '../../debug/debug.js';
import type { PathCostWeights } from './path-cost-weights.js';
import type { Samples } from './samples.js';
import type { AlignStep } from './tail-align.js';
import { stepCostOf } from './step-cost-of.js';
import { gapExtendOf } from './gap-extend-of.js';

const { min } = Math;


/**
 * Gotoh affine-gap alignment of two profiles with PRICED end skips at the
 * leaf ends (sample index 0): the alignment may start at (i,0) or (0,j),
 * paying the tail weight per skipped arc length - the skipped stretch is
 * the retracting leaf tail. The junction ends are pinned (`bothEnds` also
 * prices skips there - for the trunk, whose both ends are leaf tips).
 * ALL costs are integrated over normalized arc length (`stepA`/`stepB` =
 * length per sample), keeping match, gap and tail prices commensurate.
 * Returns the full traceback, start → end.
 */
function alignProfiles(
        fA: Samples,
        fB: Samples,
        stepA: number,
        stepB: number,
        bothEnds: boolean,
        weights: PathCostWeights): AlignStep[] {

    const { gapOpen, gapExtend, tail, radius, turning } = weights;

    const nA = fA.u.length;
    const nB = fB.u.length;
    // a gapped sample costs by its material, as in `productDtw`
    const extA = gapExtendOf(gapExtend, stepA, fA.r);
    const extB = gapExtendOf(gapExtend, stepB, fB.r);
    const tailUnitA = tail * stepA;
    const tailUnitB = tail * stepB;
    const diagStep = (stepA + stepB) / 2;

    // mirror-invariant turning (see align-branches)
    const stepCost = stepCostOf(diagStep, radius, turning);
    const cost = (i: number, j: number): number =>
        stepCost(fA.r[i], fB.r[j], fA.turn[i], fB.turn[j]);

    const INF = Infinity;
    const M: number[][] = [];
    const Ix: number[][] = [];
    const Iy: number[][] = [];
    const fromM: (0|1|2)[][] = [];
    for (let i = 0; i < nA; i++) {
        M.push(new Array(nB).fill(INF));
        Ix.push(new Array(nB).fill(INF));
        Iy.push(new Array(nB).fill(INF));
        fromM.push(new Array(nB).fill(0) as (0|1|2)[]);
    }

    // Fresh starts along the leaf edges (the only way M is set at i=0/j=0).
    M[0][0] = cost(0, 0);
    for (let i = 1; i < nA; i++) {
        M[i][0] = i*tailUnitA + cost(i, 0);
        Ix[i][0] = min(M[i - 1][0] + gapOpen, Ix[i - 1][0]) + extA(i);
    }
    for (let j = 1; j < nB; j++) {
        M[0][j] = j*tailUnitB + cost(0, j);
        Iy[0][j] = min(M[0][j - 1] + gapOpen, Iy[0][j - 1]) + extB(j);
    }

    for (let i = 1; i < nA; i++) {
        for (let j = 1; j < nB; j++) {
            const prevM = M[i - 1][j - 1];
            const prevIx = Ix[i - 1][j - 1];
            const prevIy = Iy[i - 1][j - 1];
            const best = min(prevM, prevIx, prevIy);
            M[i][j] = best + cost(i, j);
            fromM[i][j] = best === prevM ? 0 : best === prevIx ? 1 : 2;

            Ix[i][j] = min(M[i - 1][j] + gapOpen, Ix[i - 1][j]) + extA(i);
            Iy[i][j] = min(M[i][j - 1] + gapOpen, Iy[i][j - 1]) + extB(j);
        }
    }

    // Terminal: pinned at (nA-1, nB-1), or (trunk) priced end skips.
    let bi = nA - 1;
    let bj = nB - 1;
    let bState: 0|1|2 = stateAt(bi, bj);
    let bCost = valAt(bi, bj, bState);

    if (bothEnds) {
        for (let i = 0; i < nA - 1; i++) {
            const s = stateAt(i, nB - 1);
            const v = valAt(i, nB - 1, s) + (nA - 1 - i)*tailUnitA;
            if (v < bCost) { bCost = v; bi = i; bj = nB - 1; bState = s; }
        }
        for (let j = 0; j < nB - 1; j++) {
            const s = stateAt(nA - 1, j);
            const v = valAt(nA - 1, j, s) + (nB - 1 - j)*tailUnitB;
            if (v < bCost) { bCost = v; bi = nA - 1; bj = j; bState = s; }
        }
    }

    // Traceback for the start tails, recording the full alignment path.
    const steps: AlignStep[] = [];
    let i = bi;
    let j = bj;
    let state = bState;
    while (!(state === 0 && (i === 0 || j === 0))) {
        steps.push({ i, j, state, cost: state === 0 ? cost(i, j) : 0 });
        if (state === 0) {
            const s = fromM[i][j];
            i--; j--;
            state = s;
        } else if (state === 1) {
            state = i > 1 && Ix[i - 1][j] <= M[i - 1][j] + gapOpen ? 1 : 0;
            i--;
        } else {
            state = j > 1 && Iy[i][j - 1] <= M[i][j - 1] + gapOpen ? 2 : 0;
            j--;
        }
    }
    steps.push({ i, j, state: 0, cost: cost(i, j) });
    steps.reverse();

    return steps;


    function stateAt(x: number, y: number): 0|1|2 {
        return (
              M[x][y] <= Ix[x][y] && M[x][y] <= Iy[x][y]
            ? 0
            : Ix[x][y] <= Iy[x][y]
            ? 1
            : 2
        );
    }

    function valAt(x: number, y: number, s: 0|1|2): number {
        return (
              s === 0
            ? M[x][y]
            : s === 1
            ? Ix[x][y]
            : Iy[x][y]
        );
    }
}


export { alignProfiles }