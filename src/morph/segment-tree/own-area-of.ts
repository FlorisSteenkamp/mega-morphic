import type { Circle } from 'flo-mat';
import type { Segment } from './segment.js';
import { evalDeCasteljau } from 'flo-bezier3';
import { geomOf$ } from './geom-of.js';
import { segmentLoop } from './segment-area.js';

const { abs, atan2, max, sqrt } = Math;


/** points per bezier when a region's loop is flattened */
const FLATTEN_N = 8;

/** per segment: its region's area outside each disk asked for */
const ownAreas = new WeakMap<Segment, Map<Circle, number>>();


/**
 * Returns the area of the region a segment owns (`segmentArea`) outside
 * the given disk.
 *
 * * a child's own material: the part of its region inside its junction
 *   disk is its parent's - e.g. a stub at a fat fork owns a whole sector of
 *   the fork disk (`segmentArea`), yet adds only the boundary bulge beyond
 *   it to the shape
 *
 * * measured on the flattened loop, the disk's part too, so a region
 *   inside the disk comes out at exactly 0
 *
 * * memoized per segment and disk
 *
 * @param seg the segment
 * @param disk the disk to leave out (a child's junction)
 */
function ownAreaOf$(
        seg: Segment,
        disk: Circle): number {

    let byDisk = ownAreas.get(seg);
    if (byDisk === undefined) {
        byDisk = new Map();
        ownAreas.set(seg, byDisk);
    }

    let area = byDisk.get(disk);
    if (area === undefined) {
        area = calcOwnArea(seg, disk);
        byDisk.set(disk, area);
    }

    return area;
}


/** Returns the segment's region area outside the disk (see `ownAreaOf$`). */
function calcOwnArea(
        seg: Segment,
        disk: Circle): number {

    const { vertS, vertE, sleeves, caps } = geomOf$(seg);
    const loop = segmentLoop(vertS, vertE, sleeves, caps);
    if (loop.length === 0) { return 0; }

    const ps = flatten(loop);

    return max(0, abs(calcPolygonArea(ps)) - abs(calcPolygonDiskArea(ps, disk)));
}


/**
 * Returns the closed loop of beziers as a polygon (`FLATTEN_N` points per
 * curve, a line's start point only).
 */
function flatten(loop: number[][][]): number[][] {
    const ps: number[][] = [];
    for (const bz of loop) {
        const n = bz.length === 2 ? 1 : FLATTEN_N;
        for (let i = 0; i < n; i++) { ps.push(evalDeCasteljau(bz, i/n)); }
    }

    return ps;
}


/** Returns the polygon's signed area (shoelace). */
function calcPolygonArea(ps: number[][]): number {
    let area = 0;
    for (let i = 0; i < ps.length; i++) {
        const [x0, y0] = ps[i];
        const [x1, y1] = ps[(i + 1) % ps.length];
        area += x0*y1 - x1*y0;
    }

    return area/2;
}


/**
 * Returns the signed area of the polygon's intersection with the disk: the
 * sum over its edges of the signed area of the disk's intersection with the
 * triangle (centre, edge start, edge end).
 */
function calcPolygonDiskArea(
        ps: number[][],
        disk: Circle): number {

    const { center: [cx, cy], radius: r } = disk;

    let area = 0;
    for (let i = 0; i < ps.length; i++) {
        const [x0, y0] = ps[i];
        const [x1, y1] = ps[(i + 1) % ps.length];
        area += calcEdgeDiskArea([x0 - cx, y0 - cy], [x1 - cx, y1 - cy], r);
    }

    return area;
}


/**
 * Returns the signed area of the intersection of the disk of radius `r`
 * about the origin with the triangle (origin, `p`, `q`).
 *
 * * the edge is cut where it crosses the circle: a piece inside adds its
 *   triangle, a piece outside the sector it subtends
 */
function calcEdgeDiskArea(
        p: number[],
        q: number[],
        r: number): number {

    const [px, py] = p;
    const dx = q[0] - px;
    const dy = q[1] - py;

    // |p + t·d|² = r²
    const a = dx*dx + dy*dy;
    const b = 2*(px*dx + py*dy);
    const c = px*px + py*py - r*r;
    const disc = b*b - 4*a*c;

    const ts = [0];
    if (a > 0 && disc > 0) {
        const s = sqrt(disc);
        for (const t of [(-b - s)/(2*a), (-b + s)/(2*a)]) {
            if (t > 0 && t < 1) { ts.push(t); }
        }
    }
    ts.push(1);

    let area = 0;
    for (let i = 0; i + 1 < ts.length; i++) {
        const t0 = ts[i];
        const t1 = ts[i + 1];
        const ux = px + t0*dx;
        const uy = py + t0*dy;
        const vx = px + t1*dx;
        const vy = py + t1*dy;
        const mx = px + (t0 + t1)/2*dx;
        const my = py + (t0 + t1)/2*dy;
        const cr = ux*vy - uy*vx;

        area += mx*mx + my*my <= r*r
            ? cr/2
            : r*r*atan2(cr, ux*vx + uy*vy)/2;
    }

    return area;
}


export { ownAreaOf$ }
