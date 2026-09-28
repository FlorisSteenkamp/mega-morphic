import { getLastP } from '../../fs/get-last-p.js';

const { hypot } = Math;


const MIN_LEN = 1e-6;

/** gaps up to this are welded shut (below visual relevance); larger ones
 *  get an explicit bridge segment */
const SNAP_LEN = 1e-3;


/**
 * Chains ordered open pieces into one closed loop: consecutive pieces are
 * snapped together when their endpoints (nearly) coincide, else bridged with
 * a line segment; single-point pieces act as polyline waypoints.
 */
function assembleLoop(
        pieces: number[][][]): number[][][] | undefined {

    const loop: number[][][] = [];

    for (let ps of pieces) {
        const prev = loop[loop.length - 1];
        if (prev === undefined) {
            if (ps.length >= 2) { loop.push(ps); }
            continue;
        }

        const q = prev[prev.length - 1];
        const gap = hypot(ps[0][0] - q[0], ps[0][1] - q[1]);
        // console.log(gap);

        if (ps.length === 1) {  // waypoint
            if (gap > MIN_LEN) { loop.push([q, ps[0]]); }
            continue;
        }

        if (gap > SNAP_LEN) {
            loop.push([q, ps[0]]);  // bridge
        } else {
            ps = [q, ...ps.slice(1)];  // snap for exact continuity
        }
        loop.push(ps);
    }

    if (loop.length < 2) { return undefined; }

    // Close the loop exactly.
    const first = loop[0][0];
    const last = getLastP(loop);
    const gap = hypot(first[0] - last[0], first[1] - last[1]);
    if (gap > SNAP_LEN) {
        loop.push([last, first]);
    } else {
        const lastPs = loop[loop.length - 1];
        loop[loop.length - 1] = [...lastPs.slice(0, -1), first];
    }

    return loop;
}


export { assembleLoop }
