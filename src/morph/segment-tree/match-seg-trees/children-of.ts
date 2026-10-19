import type { Circle } from 'flo-mat';
import type { Segment, RouteStep } from '../segment.js';
import type { SegChild } from './seg-child.js';
import { cross, dot } from 'flo-vector2d';
import { geomOf$ } from '../geom-of.js';
import { sum } from '../../../utils/sum.js';
import { chordDir } from './chord-dir.js';
import { meanDir } from './mean-dir.js';
import { collectSubtree } from './collect-subtree.js';
import { clamp } from '../../../utils/clamp.js';

const { atan2, PI: π } = Math;


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

    const L = d;
    const rS = verts[0].radius;
    const rE = verts[verts.length - 1].radius;

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
            // sweep (see `calcSweep`).
            const terminal = i === verts.length - 1
                ? 'end' as const
                : i === 0
                ? 'start' as const
                : undefined;
            const sweep = terminal !== undefined
                ? calcSweep(terminal, θ)
                : undefined;
            const side = cr >= 0 ? 1 : -1;

            // The idealized outline (`outlineLenOf`): out flank, end cap,
            // back flank, start cap. A terminal sweeping past its cap's far
            // contact is clamped onto it, so positions keep the walk order.
            const outlinePos =
                terminal === 'end' ? L + rE*clamp(sweep!, 0, π)
                : terminal === 'start' ? 2*L + π*rE + rS*clamp(sweep!, 0, π)
                : side === 1 ? dists[i]
                : L + π*rE + (L - dists[i]);

            segChildren.push({
                attachV: v,
                dist: dists[i],
                side,
                angle: θ,
                routeDir: atan2(rd[1], rd[0]),
                entry,
                segs,
                material: sum(segs.map(s => geomOf$(s).material)) / (unit**2),
                outlinePos,
                ...(terminal !== undefined ? { terminal, sweep } : {})
            });
        }
    }

    return segChildren;
}


/**
 * Returns the angle a child at the route's end/start disk sits at, walked
 * around that disk's cap from the contact point of the arriving flank.
 *
 * * the outline arrives at the end cap along the out flank (side `1`) and
 *   at the start cap along the back flank (side `-1`), and walks either cap
 *   clockwise
 *
 * * `0` is the arriving flank's contact point and `π` the leaving flank's
 *
 * * the walk starts and ends at the route's own prong, so the result lies in
 *   `[-π/2, 3π/2]` and orders the cap's children even for collinear
 *   continuations (values outside `[0, π]` point back along a flank)
 *
 * @param terminal the route end the child attaches at
 * @param θ the child's signed angle from the route's travel direction
 */
function calcSweep(
        terminal: 'start' | 'end',
        θ: number): number {

    return terminal === 'end'
        ? π/2 - θ
        : -π/2 - (θ < 0 ? θ : θ - 2*π);
}


export { childrenOf }
