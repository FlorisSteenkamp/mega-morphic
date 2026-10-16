declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import { pairsOf } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
import { drawAlignSteps, distToPss, svgGroup } from './align-viz.js';

const { min } = Math;


/**
 * Finds the aligned path pair (from the trunk match) nearest the clicked
 * point and draws its profile alignment into BOTH shape svgs: matched
 * stretches share a color (cycled), stroke width scales with match quality,
 * unmatched tails are gray.
 */
function logProfileAlignment(
        g: SVGGElement, p: number[], showDelay?: number) {

    const pm = _debug_.elems.pathMatchResult[0];
    if (pm === undefined) { return; }

    const paths = pairsOf(pm.trunk)
        .map(({ mp }) => mp)
        .filter(mp => mp.align !== undefined);

    if (paths.length === 0) {
        console.log('no alignment debug data', pm);
        return;
    }

    let best = paths[0];
    let bestD = Infinity;
    for (const mp of paths) {
        const al = mp.align!;
        const d = min(distToPss(p, al.skelPssA), distToPss(p, al.skelPssB));
        if (d < bestD) { bestD = d; best = mp; }
    }

    const al = best.align!;
    const g1 = svgGroup('svg');
    const g2 = svgGroup('svg2');
    if (g1 === undefined || g2 === undefined) { return; }

    if (!drawAlignSteps(g1, g2, al, showDelay)) {
        console.log('degenerate alignment', al);
        return;
    }

    console.log('profile alignment:', {
        shapeCost: best.shapeCost,
        align: al
    });
}


export { logProfileAlignment }
