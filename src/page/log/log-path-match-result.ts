declare var _debug_: Debug; 
import type { Debug } from '../../debug/debug.js';
import type { PathMatchResult } from '../../morph/match-paths/path-match-result.js';
import type { MatchedPath } from '../../morph/match-paths/matched-path.js';
import type { PathChildOp } from '../../morph/match-paths/path-child-op.js';
import type { PooledChild } from '../../morph/match-paths/pooled-child.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';

const { hypot, PI: π } = Math;


/**
 * Logs the trunk-match child op (match/delete/insert) nearest to the
 * clicked point and highlights its branch(es) for `showDelay` millis.
 */
function logPathMatchResult(
        g: SVGGElement, p: number[], showDelay?: number) {

    const pm: PathMatchResult | undefined = _debug_.elems.pathMatchResult[0];
    if (pm === undefined) { return; }

    const ops: PathChildOp[] = [];
    collect(pm.trunk);

    if (ops.length === 0) {
        console.log('no child ops in trunk match', pm);
        return;
    }

    let best = ops[0];
    let bestD = Infinity;
    for (const op of ops) {
        const d = op.type === 'match'
            ? Math.min(
                distToBranch(p, op.a.edge.branch),
                distToBranch(p, op.b.edge.branch))
            : distToBranch(
                p, (op.type === 'delete' ? op.a : op.b).edge.branch);

        if (d < bestD) { bestD = d; best = op; }
    }

    // Highlight in the app's frame convention: a = red, b = green.
    if (best.type !== 'insert') {
        highlight(g, best.a.edge.branch.pss, 'red', showDelay);
    }
    if (best.type !== 'delete') {
        highlight(g, best.b.edge.branch.pss, 'green', showDelay);
    }

    console.log(`nearest op: ${best.type}`);
    if (best.type !== 'insert') { logChild('a', best.a); }
    if (best.type !== 'delete') { logChild('b', best.b); }
    if (best.type === 'match') {
        console.log('  sub-match cost:', best.sub.cost);
    }


    function collect(mp: MatchedPath): void {
        for (const op of mp.children) {
            ops.push(op);
            if (op.type === 'match') { collect(op.sub); }
        }
    }
}


function logChild(side: 'a' | 'b', c: PooledChild): void {
    console.log(`  ${side}:`, {
        angleFromParent: `${c.angle.toFixed(3)} rad (${
            (c.angle * 180 / π).toFixed(1)}°)`,
        sideOfParent: c.side,
        distAlongPath: c.dist,
        distanceFromLeaf: c.edge.distanceFromLeaf,
        roundSalience: c.edge.branch.roundSalience,
        roundSalienceFromLeaf: c.edge.roundSalienceFromLeaf,
        branch: c.edge.branch
    });
}


/** Min distance from `p` to the outline's control points. */
function distToBranch(p: number[], branch: FatBranch): number {
    let d = Infinity;
    for (const ps of branch.pss) {
        for (const q of ps) {
            d = Math.min(d, hypot(q[0] - p[0], q[1] - p[1]));
        }
    }
    return d;
}


function highlight(
        g: SVGGElement,
        pss: number[][][],
        color: string,
        showDelay?: number): void {

    const [$path] = drawBeziersAsSinglePath(g, pss, `thin20 ${color} fill25`);
    if ($path !== undefined && showDelay) {
        setTimeout(() => $path.remove(), showDelay);
    }
}


export { logPathMatchResult }
