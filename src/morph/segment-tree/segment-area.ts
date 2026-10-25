import type { Circle } from 'flo-mat';
import { getShapeArea } from 'flo-boolean';
import { getLastP } from '../fs/get-last-p.js';

const { abs } = Math;


/**
 * The area of the region a segment owns: the strip between its two
 * sleeves, closed at each end by a wedge through the end vertex's centre -
 * or by its cap, at a leaf disk with one.
 *
 * * at a fork the wedge is the sector of the fork disk between the two
 *   sleeve endpoints (two of the disk's contact points), so the segments
 *   meeting there split the disk exactly - the regions tile the shape with
 *   no overlap and no gap
 *
 * * at a leaf tip the sleeve endpoints coincide, the wedge is degenerate
 *   and the sleeves already enclose the tip
 *
 * * at a leaf disk of nonzero radius (e.g. where the SAT cut a branch) the
 *   cap's boundary closes the region (`capOf`): a wedge would leave the cap
 *   out
 *
 * Signed area via Green's theorem over the closed loop (`getShapeArea`),
 * made positive.
 *
 * @param vertS the start vertex
 * @param vertE the end vertex
 * @param sleeves the boundary pieces alongside each skeleton edge
 * @param caps the boundary round a leaf disk's cap at either end (empty
 * where there is none)
 */
function segmentArea(
        vertS: Circle,
        vertE: Circle,
        sleeves: readonly { out: number[][][]; back: number[][][] }[],
        caps: { start: number[][][]; end: number[][][] }): number {

    const loop = segmentLoop(vertS, vertE, sleeves, caps);

    return loop.length === 0 ? 0 : abs(getShapeArea(loop));
}


/**
 * Returns the closed boundary loop of the region a segment owns (see
 * `segmentArea`) - empty if a side has no sleeve.
 */
function segmentLoop(
        vertS: Circle,
        vertE: Circle,
        sleeves: readonly { out: number[][][]; back: number[][][] }[],
        caps: { start: number[][][]; end: number[][][] }): number[][][] {

    // `out` runs S → E along one side, `back` runs E → S along the other
    const out = sleeves.flatMap(e => e.out);
    const back = sleeves.toReversed().flatMap(e => e.back);
    if (out.length === 0 || back.length === 0) { return []; }

    const outEnd = getLastP(out);
    const backStart = back[0][0];
    const backEnd = getLastP(back);
    const outStart = out[0][0];

    return closeGaps([
        ...out,
        ...(caps.end.length > 0 ? caps.end : wedge(outEnd, vertE.center, backStart)),
        ...back,
        ...(caps.start.length > 0 ? caps.start : wedge(backEnd, vertS.center, outStart))
    ]);
}


/**
 * Returns the loop with a straight piece bridging every gap between a piece
 * and the next (the last piece's next being the first).
 *
 * * the sleeves need not be continuous: at a leaf the SAT cut (a split
 *   disk, see `markSplitDisks`) the twin of the last step can start
 *   elsewhere on the boundary
 *
 * * Green's theorem over an open loop depends on where the origin is (each
 *   gap drops a term of the order of its length times its distance from the
 *   origin), so even a small gap far from the origin can swamp the area
 */
function closeGaps(loop: number[][][]): number[][][] {
    const closed: number[][][] = [];
    for (let i = 0; i < loop.length; i++) {
        const ps = loop[i];
        const p = getLastP([ps]);
        const q = loop[(i + 1) % loop.length][0];

        closed.push(ps);
        if (p[0] !== q[0] || p[1] !== q[1]) { closed.push([p, q]); }
    }

    return closed;
}


/** The two straight pieces `p` → `c` → `q` (none when `p` and `q` coincide). */
function wedge(p: number[], c: number[], q: number[]): number[][][] {
    return p[0] === q[0] && p[1] === q[1]
        ? []
        : [[p, c], [c, q]];
}


export { segmentArea, segmentLoop }
