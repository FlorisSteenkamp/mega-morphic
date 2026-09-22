import type { PathChildOp } from './path-child-op.js';
import type { PooledChild } from './pooled-child.js';
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
        pooledB: PooledChild[]): { ops: PathChildOp[]; cost: number } {

    const matchSubtrees$_ = matchSubtrees$(sal1, sal2, w);
    const relabelCost_ = relabelCost(w, sal1, sal2);
    const delCost_ = delCost(w, sal1);
    const insCost_ = insCost(w, sal2);

    const ops: PathChildOp[] = [];
    let cost = 0;

    for (const side of [1, -1] as const) {
        // Boundary-walk order: out side ascending, back side descending.
        const As = pooledA
            .filter(c => c.side === side)
            .sort((x, y) => side * (x.dist - y.dist));
        
        const Bs = pooledB
            .filter(c => c.side === side)
            .sort((x, y) => side * (x.dist - y.dist));

        const r = alignSeq(As, Bs, relabelCost_, delCost_, insCost_);
        cost += r.cost;

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

    return { ops, cost };
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
        return weights.delFloor + weights.del * a.edge.branch.roundSalience / sal1;
    }
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
function relabelCost(
        weights: PathCostWeights,
        sal1: number,
        sal2: number) {

    return function(a: PooledChild, b: PooledChild): number {
        const { position, angle } = weights;
        const unit1 = sqrt(sal1);
        const unit2 = sqrt(sal2);
        const matchSubtrees$_ = matchSubtrees$(sal1, sal2, weights);

        return (
            position * abs(a.dist/unit1 - b.dist/unit2) +
            angle * angleDist(a.angle, b.angle)/π +
            matchSubtrees$_(a.edge.branch, b.edge.branch).cost
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