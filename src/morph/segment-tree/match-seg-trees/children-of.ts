import type { Circle } from 'flo-mat';
import type { Segment, RouteStep } from '../segment.js';
import type { SegChild } from './seg-child.js';
import { cross, dot } from 'flo-vector2d';
import { geomOf$ } from '../geom-of.js';
import { sum } from '../../../utils/sum.js';
import { chordDir } from './chord-dir.js';
import { meanDir } from './mean-dir.js';
import { collectSubtree } from './collect-subtree.js';

const { atan2 } = Math;


/**
 * The subtrees hanging off a route within `scope`, with position along the
 * route, side and emanation angle (chord-based directions).
 */
function childrenOf(
        scope: Segment[],
        route: RouteStep[],
        unit: number): SegChild[] {

    const routeSegs = new Set(route.map(r => r.seg));

    // vertex → incident scope segments off the route
    const adj = new Map<Circle, Segment[]>();
    for (const s of scope) {
        if (routeSegs.has(s)) { continue; }
        const { vertS, vertE } = geomOf$(s);
        for (const v of [vertS, vertE]) {
            adj.getOrInsert(v, []).push(s);
        }
    }

    // route vertex sequence + cumulative dist + local travel direction
    const verts: Circle[] = [];
    const dists: number[] = [];
    const dirs: number[][] = [];
    let d = 0;
    for (let i = 0; i < route.length; i++) {
        const { seg, reversed } = route[i];
        const { vertS, vertE, skelLen } = geomOf$(seg);
        const v = reversed ? vertE : vertS;
        const dirOutV = chordDir(seg, reversed ? 'endRev' : 'start');
        if (i === 0) {
            verts.push(v); dists.push(d); dirs.push(dirOutV);
        } else {
            // interior vertex: mean of arriving and leaving directions
            const prev = route[i - 1];
            const dirIn = chordDir(prev.seg, prev.reversed ? 'startRev' : 'end');
            dirs[dirs.length - 1] = meanDir(dirIn, dirOutV);
        }
        d += skelLen;
        verts.push(reversed ? vertS : vertE);
        dists.push(d);
        dirs.push(chordDir(seg, reversed ? 'startRev' : 'end'));
    }

    const segChildren: SegChild[] = [];
    const claimed = new Set<Segment>();

    for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        for (const entry of adj.get(v) ?? []) {
            if (claimed.has(entry)) { continue; }
            const segs = collectSubtree(entry, v, adj);
            for (const s of segs) { claimed.add(s); }

            const cd = chordDir(entry, geomOf$(entry).vertS === v ? 'start' : 'endRev');
            const rd = dirs[i];
            const cr = cross(rd, cd);
            const θ = atan2(cr, dot(rd, cd));

            // Seam terminals: children AT a route end, ordered by the fork
            // sweep (the sleeve boundary walks the end cap from the out
            // side: descending θ; the start cap toward the out side:
            // ascending θ). The cut sits at the route's own prong, so the
            // order is well defined even for collinear continuations.
            const terminal = i === verts.length - 1
                ? 'end' as const
                : i === 0
                ? 'start' as const
                : undefined;
            const sweep = terminal === 'end' ? -θ
                : terminal === 'start' ? θ
                : undefined;

            segChildren.push({
                attachV: v,
                dist: dists[i],
                side: cr >= 0 ? 1 : -1,
                angle: θ,
                entry,
                segs,
                material: sum(segs.map(s => geomOf$(s).material)) / (unit**2),
                ...(terminal !== undefined ? { terminal, sweep } : {})
            });
        }
    }

    return segChildren;
}


export { childrenOf }
