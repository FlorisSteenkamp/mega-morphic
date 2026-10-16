declare var _debug_: Debug; 
import type { Debug } from '../../debug/debug.js';
import type { PathMatchResult } from '../../debug/path-match-result.js';
import type { SegChild } from '../../morph/segment-tree/match-seg-trees/seg-child.js';
import { pairsOf } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { geomOf$ } from '../../morph/segment-tree/geom-of.js';
import { distToPss } from './align-viz.js';

const { PI: π } = Math;


/**
 * Logs the trunk-match child op (match/delete/insert) nearest to the
 * clicked point and highlights its subtree skeleton(s) for `showDelay`
 * millis.
 */
function logPathMatchResult(
        g: SVGGElement, p: number[], showDelay?: number) {

    const pm: PathMatchResult | undefined = _debug_.elems.pathMatchResult[0];
    if (pm === undefined) { return; }

    const ops = pairsOf(pm.trunk).flatMap(({ mp }) => mp.ops);

    if (ops.length === 0) {
        console.log('no child ops in trunk match', pm);
        return;
    }

    let best = ops[0];
    let bestD = Infinity;
    for (const op of ops) {
        const d = op.type === 'match'
            ? Math.min(
                distToChild(p, op.a),
                distToChild(p, op.b))
            : distToChild(
                p, op.type === 'delete' ? op.a : op.b);

        if (d < bestD) { bestD = d; best = op; }
    }

    // Highlight in the app's frame convention: a = red, b = green.
    if (best.type !== 'insert') {
        drawBeziersAsSinglePath(g, skelOf(best.a), 'thin20 red nofill', showDelay);
    }
    if (best.type !== 'delete') {
        drawBeziersAsSinglePath(g, skelOf(best.b), 'thin20 green nofill', showDelay);
    }

    console.log(`nearest op: ${best.type}`);
    if (best.type !== 'insert') { logChild('a', best.a); }
    if (best.type !== 'delete') { logChild('b', best.b); }
    if (best.type === 'match') {
        console.log('  sub-match cost:', best.sub.cost);
    }
}


function logChild(side: 'a' | 'b', c: SegChild): void {
    console.log(`  ${side}:`, {
        angleFromParent: `${c.angle.toFixed(3)} rad (${
            (c.angle * 180 / π).toFixed(1)}°)`,
        sideOfParent: c.side,
        distAlongRoute: c.dist,
        material: c.material,
        entry: c.entry,
        segs: c.segs
    });
}


/** The subtree's skeleton beziers. */
function skelOf(c: SegChild): number[][][] {
    return c.segs.flatMap(s => geomOf$(s).skelPss);
}


/** Min distance from `p` to the subtree's skeleton control points. */
function distToChild(p: number[], c: SegChild): number {
    return distToPss(p, skelOf(c));
}


export { logPathMatchResult }
