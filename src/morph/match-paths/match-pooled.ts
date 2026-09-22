declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PathChildOp } from './path-child-op.js';
import type { PooledChild } from './pooled-child.js';
import type { PooledDp } from './matched-path.js';
import { alignSeq } from './align-seq.js';
import { matchSubtrees$ } from './match-subtrees.js';
import { PathCostWeights } from './path-cost-weights.js';
import { FatBranch } from '../fat-branch/fat-branch.js';

const { sqrt, abs, PI: π } = Math;


/**
 * Per-side monotone alignment of two paths' pooled child forks.
 */
function matchPooled(
        sal1: number,
        sal2: number,
        w: PathCostWeights,
        pooledA: PooledChild[],
        pooledB: PooledChild[]):
        { ops: PathChildOp[]; cost: number; dp?: PooledDp[] } {

    const matchSubtrees$_ = matchSubtrees$(sal1, sal2, w);
    const matchCost_ = matchCost(w, sal1, sal2);
    const delCost_ = delCost(w, sal1);
    const insCost_ = insCost(w, sal2);

    const ops: PathChildOp[] = [];
    const dp: PooledDp[] | undefined =
        typeof _debug_ !== 'undefined' ? [] : undefined;
    let cost = 0;

    for (const side of [1, -1] as const) {
        // Boundary-walk order: out side ascending, back side descending.
        const As = pooledA
            .filter(c => c.side === side)
            .sort((x, y) => side * (x.dist - y.dist));
        
        const Bs = pooledB
            .filter(c => c.side === side)
            .sort((x, y) => side * (x.dist - y.dist));

        const r = alignSeq(As, Bs, matchCost_, delCost_, insCost_);
        cost += r.cost;
        dp?.push({ side, D: r.D, as: As, bs: Bs, ops: r.ops });

        for (const op of r.ops) {
            ops.push(op.type === 'match'
                ? {
                    type: 'match',
                    a: op.a,
                    b: op.b,
                    sub: matchSubtrees$_(op.a.edge.branch, op.b.edge.branch)
                }
                : op);
        }
    }

    return { ops, cost, ...(dp !== undefined ? { dp } : {}) };
}


/**
 * Returns the Relable / Match cost (calculated recursiveliy on children)
 * 
 * @param weights 
 * @param sal1 
 * @param sal2 
 * @param a
 * @param b
 */
function matchCost(
        weights: PathCostWeights,
        sal1: number,
        sal2: number) {

    return function(a: PooledChild, b: PooledChild): number {
        const { position: wPosition, angle: wAngle } = weights;
        const unit1 = sqrt(sal1);
        const unit2 = sqrt(sal2);
        const matchSubtrees$_ = matchSubtrees$(sal1, sal2, weights);

        const sPosition = abs(a.dist/unit1 - b.dist/unit2);
        const sAngle = angleDist(a.angle, b.angle)/π;

        return (
            wPosition*sPosition +
            wAngle*sAngle +
            matchSubtrees$_(a.edge.branch, b.edge.branch).cost.totalCost
        );
    }
}


function insCost(
        weights: PathCostWeights,
        sal2: number) {

    return function(b: PooledChild): number {
        return (
            weights.delFloor +
            weights.del * (b.edge.branch.roundSalience / sal2)
        );
    }
}


function delCost(
        weights: PathCostWeights,
        sal1: number) {

    return function(a: PooledChild): number {
        return (
            weights.delFloor +
            weights.del * a.edge.branch.roundSalience / sal1
        );
    }
}


/**
 * Smallest absolute difference between two angles (in [0, π]).
 */
function angleDist(x: number, y: number): number {
    const d = abs(x - y) % (2*π);

    return d > π ? 2*π - d : d;
}


export { matchPooled }