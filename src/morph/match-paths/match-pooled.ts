import type { Context } from './context.js';
import type { PathChildOp } from './path-child-op.js';
import type { PooledChild } from './pooled-child.js';
import { alignSeq } from './align-seq.js';
import { matchSubtrees } from './match-subtrees.js';
import { PathCostWeights } from './path-cost-weights.js';

const { abs, PI: π } = Math;


/** Per-side monotone alignment of two paths' pooled child forks. */
function matchPooled(
        ctx: Context,
        w: PathCostWeights,
        pooledA: PooledChild[],
        pooledB: PooledChild[]): { ops: PathChildOp[]; cost: number } {

    // const { w } = ctx;

    const relabel = (a: PooledChild, b: PooledChild): number =>
        w.position * abs(a.dist/ctx.unit1 - b.dist/ctx.unit2) +
        w.angle * angleDist(a.angle, b.angle) / π +
        matchSubtrees(ctx, w, a.edge.branch, b.edge.branch).cost;
    const delCost = (a: PooledChild): number =>
        w.delFloor + w.del * a.edge.branch.roundSalience / ctx.sal1;
    const insCost = (b: PooledChild): number =>
        w.delFloor + w.del * b.edge.branch.roundSalience / ctx.sal2;

    const ops: PathChildOp[] = [];
    let cost = 0;

    for (const side of [1, -1] as const) {
        // Boundary-walk order: out side ascending, back side descending.
        const As = pooledA.filter(c => c.side === side)
            .sort((x, y) => side * (x.dist - y.dist));
        const Bs = pooledB.filter(c => c.side === side)
            .sort((x, y) => side * (x.dist - y.dist));

        const r = alignSeq(As, Bs, relabel, delCost, insCost);
        cost += r.cost;
        for (const op of r.ops) {
            ops.push(op.type === 'match'
                ? { type: 'match', a: op.a, b: op.b,
                    sub: matchSubtrees(
                        ctx, w, op.a.edge.branch, op.b.edge.branch) }
                : op);
        }
    }

    return { ops, cost };
}


/** Smallest absolute difference between two angles (in [0, π]). */
function angleDist(x: number, y: number): number {
    const d = abs(x - y) % (2*π);

    return d > π ? 2*π - d : d;
}


export { matchPooled }