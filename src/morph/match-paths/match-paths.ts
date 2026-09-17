import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { MatchedPath } from './matched-path.js';
import type { PathCostWeights } from './path-cost-weights.js';
import type { PathGeom } from './path-geom.js';
import type { PathMatchOptions } from './path-match-options.js';
import type { PathMatchResult } from './path-match-result.js';
import { makeContext } from './make-context.js';
import { matchPathPair } from './match-path-pair.js';
import { swayTerm } from './sway-term.js';
import { trunkCandidates, reversedOf } from './trunk-candidates.js';
import { getPolyBezierTurningAngle } from './get-poly-bezier-turning-angle.js';

const { abs, PI: π } = Math;


/**
 * Correspondence-driven PATH matching ("level 3"): the matching unit is a
 * junction-to-leaf path (a chain of fat branches descending the MAT tree),
 * and the relabel metric is the actual DTW alignability of the two paths'
 * radius + turning profiles. Merge/split (one branch corresponding to a
 * chain in the other tree) is native: it is simply a path with more than
 * one node. Off-path leaf-side stubs and unmatched leaf tails retract.
 * The TRUNK pair is likewise enumerated: leaf-to-leaf paths that may
 * REROUTE at either end (exit into a child subtree instead of running to
 * the trunk's own tip), tried in both orientations - subsuming the old
 * whole-trunk flip.
 */


const defaultPathWeights: PathCostWeights = {
    shape: 1,
    position: 0.5,
    angle: 0.25,
    del: 3,
    delFloor: 0.15,
    stub: 3,
    tail: 0.5,
    turn: 0.25,
    sway: 0.5,
    gapOpen: 0.15,
    gapExtend: 0.06
};

/** Trunk pairs kept for full-resolution evaluation (beam width); larger
 *  candidate sets are first ranked with a coarse-resolution alignment. */
const TRUNK_BEAM = 64;
const TRUNK_BEAM_THRESHOLD = 512;


/**
 * Matches the two fat branch trees path-wise: the trunk pair is the
 * cheapest pair of (possibly end-rerouted) leaf-to-leaf trunk paths over
 * both orientations of tree 2; below it, every matched fork pair
 * recursively picks the cheapest pair of junction-to-leaf paths through
 * its two subtrees.
 */
function matchPaths(
        tree1: FatBranch,
        tree2: FatBranch,
        opts: PathMatchOptions = {}): PathMatchResult {

    const weights: PathCostWeights = {
        ...defaultPathWeights,
        ...opts.weights
    };

    const turnTerm_ = turnTerm(weights.turn);

    // const ctx = makeContext(tree1, tree2, weights);
    const ctx = makeContext(tree1, tree2);

    const { paths1, paths2 } = ctx;

    const candA = trunkCandidates(tree1, paths1);
    const candB = trunkCandidates(tree2, paths2);

    let cands: { pA: PathGeom; pB: PathGeom; rev: boolean }[] = [];
    for (const pA of candA) {
        for (const pB0 of candB) {
            cands.push({ pA, pB: pB0, rev: false });
            cands.push({ pA, pB: reversedOf(pB0), rev: true });
        }
    }

    // Beam: rank with a coarse-resolution alignment (same cost structure),
    // keep the best for full-resolution evaluation. The plain trunk pair
    // always stays in (both orientations).
    if (cands.length > TRUNK_BEAM_THRESHOLD) {
        const plain = cands.slice(0, 2);
        const ranked = cands.map(c => ({
            c,
            cost: matchPathPair(ctx, weights, c.pA, c.pB, true, true).cost +
                turnTerm_(c.pA, c.pB) + swayTerm(c.pA, c.pB, weights.sway)
        }));
        ranked.sort((x, y) => x.cost - y.cost);
        cands = [...plain, ...ranked.slice(0, TRUNK_BEAM).map(r => r.c)];
    }

    let best: MatchedPath | undefined;
    let bestCost = Infinity;
    let flipped = false;

    for (const { pA, pB, rev } of cands) {
        const m = matchPathPair(ctx, weights, pA, pB, true, false);
        const cost = m.cost + turnTerm_(pA, pB) + swayTerm(pA, pB, weights.sway);
        if (cost < bestCost) {
            bestCost = cost;
            best = m;
            flipped = rev;
        }
    }

    return { trunk: best!, flipped, cost: bestCost };
}


/**
 * Returns `turnWeight` * (the absolute difference in turning angle between the
 * two given `PathGeom`s) / `π`
 * 
 * * i.e., a 180 degree turn imposes a penalty of `1` times `turnWeight`
 * 
 * @param turnWeight
 */
function turnTerm(
        turnWeight: number) {

    return function(
        pA: PathGeom,
        pB: PathGeom): number {

        return turnWeight * abs(
            getPolyBezierTurningAngle(pA.bz) - 
            getPolyBezierTurningAngle(pB.bz)
        ) / π;
    }
}



export { matchPaths, defaultPathWeights }
