import type { Circle } from 'flo-mat';
import type { Segment, RouteStep } from '../segment.js';
import type { SegChild } from './seg-child.js';
import { cross, dot } from 'flo-vector2d';
import { geomOf$ } from '../geom-of.js';
import { ownAreaOf$ } from '../own-area-of.js';
import { sum } from '../../../utils/sum.js';
import { chordDir } from './chord-dir.js';
import { meanDir } from './mean-dir.js';
import { collectSubtree } from './collect-subtree.js';
import { clamp } from '../../../utils/clamp.js';

const { atan2, min, PI: π } = Math;


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

    // route vertex sequence + cumulative dist + local travel direction (+ at
    // interior vertices the arriving and leaving directions themselves)
    const verts: Circle[] = [];
    const dists: number[] = [];
    const dirs: number[][] = [];
    const prongs: ([number[], number[]] | undefined)[] = [];
    let d = 0;
    for (let i = 0; i < route.length; i++) {
        const { seg, reversed } = route[i];
        const { vertS, vertE, skelLen } = geomOf$(seg);
        const v = reversed ? vertE : vertS;
        const dirOutV = chordDir(seg, reversed ? 'endRev' : 'start');
        if (i === 0) {
            verts.push(v); dists.push(d); dirs.push(dirOutV);
            prongs.push(undefined);
        } else {
            // interior vertex: mean of arriving and leaving directions
            const prev = route[i - 1];
            const dirIn = chordDir(prev.seg, prev.reversed ? 'startRev' : 'end');
            dirs[dirs.length - 1] = meanDir(dirIn, dirOutV);
            prongs[prongs.length - 1] = [dirIn, dirOutV];
        }
        d += skelLen;
        verts.push(reversed ? vertS : vertE);
        dists.push(d);
        dirs.push(chordDir(seg, reversed ? 'startRev' : 'end'));
        prongs.push(undefined);
    }

    mergeJunctionFrames(route, verts, dirs, prongs);

    const segChildren: SegChild[] = [];
    const claimed = new Set<Segment>();

    const L = d;
    const rS = verts[0].radius;
    const rE = verts[verts.length - 1].radius;

    for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        const branches = (adj.get(v) ?? [])
            .filter(entry => !claimed.has(entry))
            .flatMap(entry => expandBranch(entry, v, adj, claimed));

        for (const { entry, at, via } of branches) {
            // the connectors back to the route vertex keep the child's
            // junction on its parent
            const segs = [...via, ...collectSubtree(entry, at, adj)];
            for (const s of segs) { claimed.add(s); }

            const cd = chordDir(entry, geomOf$(entry).vertS === at ? 'start' : 'endRev');
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
            const side = calcSide(prongs[i], cr, cd);

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
                material: sum(segs.map(s => ownAreaOf$(s, v))) / (unit**2),
                outlinePos,
                ...(terminal !== undefined ? { terminal, sweep } : {})
            });
        }
    }

    return segChildren;
}


/**
 * Gives every run of route vertices joined by connectors one frame: the
 * travel direction and prongs of the junction they make up together.
 *
 * * a connector is a route segment no longer than half the stroke width
 *   (the smaller radius at its two ends), as in `expandBranch` - the MAT
 *   happened to split one junction into several forks
 *
 * * without this, each fork of the run is measured against only the prongs
 *   it sees: a connector's chord is (near) zero, so `meanDir` falls back on
 *   the other prong - children of one junction would then sit at angles
 *   measured in different frames (e.g. both at -90° when the route turns
 *   90° at the junction, one measured against the arriving direction, the
 *   other against the leaving one)
 *
 * * the junction's prongs are the direction arriving at the run's first
 *   vertex and the one leaving its last; at a route end (no arriving or no
 *   leaving direction) the run has no prongs and the one it has is its
 *   travel direction
 *
 * * `dirs` and `prongs` are updated in place
 *
 * @param route the route
 * @param verts the route's vertices
 * @param dirs the travel direction at each route vertex
 * @param prongs the arriving and leaving directions at each route vertex
 * (`undefined` at a route end)
 */
function mergeJunctionFrames(
        route: RouteStep[],
        verts: Circle[],
        dirs: number[][],
        prongs: ([number[], number[]] | undefined)[]): void {

    let j = 0;
    while (j < route.length) {
        let k = j;
        while (k < route.length && isConnector(route[k], verts[k], verts[k + 1])) {
            k++;
        }

        if (k > j) {
            const dirIn = prongs[j]?.[0];
            const dirOut = prongs[k]?.[1];
            const dir = dirIn === undefined ? dirOut ?? dirs[j]
                : dirOut === undefined ? dirIn
                : meanDir(dirIn, dirOut);
            const prong: [number[], number[]] | undefined =
                dirIn !== undefined && dirOut !== undefined
                    ? [dirIn, dirOut]
                    : undefined;

            for (let i = j; i <= k; i++) {
                dirs[i] = dir;
                prongs[i] = prong;
            }
        }

        j = k + 1;
    }
}


/**
 * Returns `true` if the route step joining `v1` and `v2` is a connector: no
 * longer than half the smaller radius at its two ends.
 */
function isConnector(
        step: RouteStep,
        v1: Circle,
        v2: Circle): boolean {

    return geomOf$(step.seg).skelLen <= min(v1.radius, v2.radius)/2;
}


/**
 * Returns the branches a child entering through `entry` at route vertex
 * `v` stands for: each with its own first segment (`entry`), the vertex it
 * leaves from (`at`) and the connectors leading there from `v` (`via`).
 *
 * * normally just itself, at `v`, with no connectors
 *
 * * but if `entry` is only a connector to another fork - no longer than
 *   half the stroke width (the smaller radius at its two ends) - the two
 *   forks are one junction the MAT happened to split, and the branches
 *   beyond the far fork (expanded likewise) hang off the route themselves:
 *   whether a branch of a four-way junction ends up a child or a grandchild
 *   then no longer depends on how the MAT ordered the junction's two forks
 *
 * * each expanded branch carries the connectors (so its route still ends on
 *   the parent - a branch sharing a connector with a sibling draws that
 *   sliver twice)
 *
 * @param entry the child's first segment
 * @param v the vertex `entry` leaves from
 * @param adj vertex → incident segments (off the route)
 * @param claimed the segments already given to a child (connectors are
 * added)
 */
function expandBranch(
        entry: Segment,
        v: Circle,
        adj: Map<Circle, Segment[]>,
        claimed: Set<Segment>): { entry: Segment; at: Circle; via: Segment[] }[] {

    const { vertS, vertE, skelLen } = geomOf$(entry);
    const u = vertS === v ? vertE : vertS;
    const beyond = (adj.get(u) ?? []).filter(s => s !== entry);

    if (beyond.length < 2 || skelLen > min(v.radius, u.radius)/2) {
        return [{ entry, at: v, via: [] }];
    }

    claimed.add(entry);

    return beyond.flatMap(s => expandBranch(s, u, adj, claimed)
        .map(b => ({ ...b, via: [entry, ...b.via] })));
}


/**
 * Returns the side of the route a child hangs off: `1` (left of the travel
 * direction) or `-1` (right).
 *
 * * at an interior route vertex, by the sector between the route's own two
 *   prongs the child lies in: left is anticlockwise from the leaving
 *   direction round to the arriving one reversed - correct at a sharp
 *   corner too, where the mean travel direction may point right along the
 *   child (making the sign of its cross product with the child noise)
 *
 * * at a route end (no second prong), by the sign of the cross product of
 *   the travel direction with the child (`cr`)
 *
 * @param prongs the arriving and leaving travel directions at the vertex
 * (`undefined` at a route end)
 * @param cr the cross product of the (mean) travel direction with the child
 * @param cd the child's direction
 */
function calcSide(
        prongs: [number[], number[]] | undefined,
        cr: number,
        cd: number[]): 1 | -1 {

    if (prongs === undefined) { return cr >= 0 ? 1 : -1; }

    const [dirIn, dirOut] = prongs;
    const aOut = atan2(dirOut[1], dirOut[0]);
    const aBack = atan2(-dirIn[1], -dirIn[0]);
    const aChild = atan2(cd[1], cd[0]);

    // anticlockwise angle from the leaving direction
    const ccw = (a: number) => ((a - aOut) % (2*π) + 2*π) % (2*π);

    return ccw(aChild) < ccw(aBack) ? 1 : -1;
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
