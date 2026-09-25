import type { SleeveSide } from '../../anchored-sleeves.js';
import { boundaryPoint } from '../../anchored-sleeves.js';
import { capArcPts } from './cap-arc-pts.js';

const { cos, sin, hypot, PI: π } = Math;


const MIN_LEN = 1e-6;


/**
 * One side's boundary pieces at time `t`, in outline order
 * 
 * * anchors interpolated in the drawn disks' local frames
 * * chord-normalized pieces lerped and mapped through the interpolated anchor chords.
 * 
 * Fork gaps (skipped child sectors) are bridged with the fork disk's arc,
 * swept with the winding - the parent's true region boundary there.
 */
function reconstructSide(
        side: SleeveSide,
        isOut: boolean,
        bz: number[][][],
        rs: number[],
        Ts: number[][],
        capSign: number,
        t: number): { pieces: number[][][]; first: number[]; last: number[] } {

    const { piecesA, piecesB, anchorsA, anchorsB } = side;

    const len = piecesA.length;
    const pieces: number[][][] = [];
    let first = [0,0];
    let last = [0,0];

    for (let m=0; m<len; m++) {
        const k = isOut ? m : len - 1 - m;  // outline order

        const aA = anchorsA[k];
        const aB = anchorsB[k];
        const bidxFrom = isOut ? k : k + 1;
        const bidxTo = isOut ? k + 1 : k;

        const e0 = anchorPoint(
            aA[0], aA[1], aB[0], aB[1], bidxFrom, bz, rs, Ts, t);
        const e1 = anchorPoint(
            aA[2], aA[3], aB[2], aB[3], bidxTo, bz, rs, Ts, t);

        if (m === 0) {
            first = e0;
        } else {
            // Fork gap: bridge along the boundary disk at this knot.
            const gap = hypot(e0[0] - last[0], e0[1] - last[1]);
            // console.log(gap);
            if (gap > 1e-3) {
                const p = boundaryPoint(bz, bidxFrom);
                pieces.push(...capArcPts(p, rs[bidxFrom], last, e0, capSign)
                    .map(q => [q]));
            }
        }
        last = e1;

        // Chord frame of the interpolated anchors (same degenerate rule as
        // normalization so t=0/1 reproduce the originals exactly).
        let bx = e1[0] - e0[0];
        let by = e1[1] - e0[1];
        if (bx*bx + by*by < MIN_LEN*MIN_LEN*1e-6) { bx = 1; by = 0; }

        const qsA = piecesA[k];
        const qsB = piecesB[k];
        for (let i = 0; i < qsA.length; i++) {
            pieces.push(qsA[i].map((q, j) => {
                const qx = q[0]*(1 - t) + qsB[i][j][0]*t;
                const qy = q[1]*(1 - t) + qsB[i][j][1]*t;
                return [
                    e0[0] + bx*qx - by*qy,
                    e0[1] + by*qx + bx*qy
                ];
            }));
        }
    }

    return { pieces, first, last };
}


/**
 * Returns the interpolated anchor
 * 
 * * polar coords lerped (θ the short way) and applied to the DRAWN disk's
 *   local frame at skeleton boundary `bidx`.
 */
function anchorPoint(
        thA: number, rhA: number,
        thB: number, rhB: number,
        bidx: number,
        bz: number[][][],
        rs: number[],
        Ts: number[][],
        t: number): number[] {

    const dθ = ((thB - thA + π) % (2*π) + 2*π) % (2*π) - π;
    const θ = thA + t*dθ;
    const ρ = rhA*(1 - t) + rhB*t;

    const p = boundaryPoint(bz, bidx);
    const r = rs[bidx];
    const T = Ts[bidx];
    const N = [-T[1], T[0]];
    const ux = cos(θ)*T[0] + sin(θ)*N[0];
    const uy = cos(θ)*T[1] + sin(θ)*N[1];

    return [p[0] + ρ*r*ux, p[1] + ρ*r*uy];
}


export { reconstructSide }
