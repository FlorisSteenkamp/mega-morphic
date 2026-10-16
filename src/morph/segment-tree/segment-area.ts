import type { Circle } from 'flo-mat';
import { getShapeArea } from 'flo-boolean';
import { getLastP } from '../fs/get-last-p.js';

const { abs } = Math;


/**
 * The area of the region a segment owns: the strip between its two
 * sleeves, closed at each end by a wedge through the end vertex's centre.
 *
 * * at a fork the wedge is the sector of the fork disk between the two
 *   sleeve endpoints (two of the disk's contact points), so the segments
 *   meeting there split the disk exactly - the regions tile the shape with
 *   no overlap and no gap
 * * at a leaf tip the sleeve endpoints coincide, the wedge is degenerate
 *   and the sleeves already enclose the tip
 *
 * Signed area via Green's theorem over the closed loop (`getShapeArea`),
 * made positive.
 */
function segmentArea(
        vertS: Circle,
        vertE: Circle,
        sleeves: readonly { out: number[][][]; back: number[][][] }[]): number {

    // `out` runs S → E along one side, `back` runs E → S along the other
    const out = sleeves.flatMap(e => e.out);
    const back = sleeves.toReversed().flatMap(e => e.back);
    if (out.length === 0 || back.length === 0) { return 0; }

    const outEnd = getLastP(out);
    const backStart = back[0][0];
    const backEnd = getLastP(back);
    const outStart = out[0][0];

    const loop = [
        ...out,
        ...wedge(outEnd, vertE.center, backStart),
        ...back,
        ...wedge(backEnd, vertS.center, outStart)
    ];

    return abs(getShapeArea(loop));
}


/** The two straight pieces `p` → `c` → `q` (none when `p` and `q` coincide). */
function wedge(p: number[], c: number[], q: number[]): number[][][] {
    return p[0] === q[0] && p[1] === q[1]
        ? []
        : [[p, c], [c, q]];
}


export { segmentArea }
