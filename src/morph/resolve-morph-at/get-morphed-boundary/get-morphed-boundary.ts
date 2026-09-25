import type { MorphEntry } from '../../morph-entry.js';
import { getLastP } from '../../fs/get-last-p.js';
import { boundaryTangents } from '../../anchored-sleeves.js';
import { capArcPts } from './cap-arc-pts.js';
import { assembleLoop } from './assemble-loop.js';
import { reconstructSide } from './reconstruct-side.js';


/**
 * The morphed outline of one entry (i.e. a branch)
 * 
 * * per skeleton segment
 * * both frames' boundary anchors rebuilt in the DRAWN disks' local
 *   frames (so they ride the interpolated maximal disks) and interpolated;
 *   the boundary pieces between them lerped in their chord frames and mapped
 *   through the interpolated chords;
 * * the two sides closed with disk cap arcs at the tips (fork/tip gaps bridged
 *   with line segments - the loop union covers those)
 * 
 * @param entry
 * @param skelPss
 * @param radii lerped radii
 * @param t
 */
function getMorphedBoundary(
        entry: MorphEntry,
        skelPss: number[][][],
        radii: number[],
        t: number): number[][][] | undefined {

    const { sleeveOut, sleeveBack, capSign } = entry;

    if (sleeveOut === undefined || sleeveBack === undefined) { return undefined; }
    if (sleeveOut.piecesA.length === 0) { return undefined; }

    const Ts = boundaryTangents(skelPss);

    const out = reconstructSide(sleeveOut, true, skelPss, radii, Ts, capSign, t);
    const back = reconstructSide(sleeveBack, false, skelPss, radii, Ts, capSign, t);

    const pStart = skelPss[0][0];
    const pEnd = getLastP(skelPss);

    // out runs tip → end, back runs end → tip (outline direction).
    // A glued entry closes through its JUNCTION (= pEnd, glued onto the
    // parent's skeleton, strictly interior to the parent's region) - the
    // wedge guarantees overlap with the parent at every t, and at t=0/1 its
    // extra sliver is covered by the parent's fork-gap arc.
    const endCap = entry.glue !== undefined
        ? [pEnd]
        : capArcPts(pEnd, radii[radii.length - 1], out.last, back.first, capSign);

    const startCap = capArcPts(
        pStart, radii[0], back.last, out.first, capSign
    );

    return assembleLoop([
        ...out.pieces,
        ...endCap.map(p => [p]),
        ...back.pieces,
        ...startCap.map(p => [p]),
    ]);
}


export { getMorphedBoundary }
