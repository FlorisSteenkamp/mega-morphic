import { fillGaps } from '../fs/fill-gaps.js';

const { atan2, hypot } = Math;


const EPS = 1e-9;


/**
 * Per-segment chord length and angle; degenerate chord angles are filled
 * from the nearest non-degenerate segment.
 * 
 * @param pss
 */
function chords(
        pss: number[][][]): { L: number[]; phi: number[] } {

    const L: number[] = [];
    const rawPhi: number[] = [];

    for (const ps of pss) {
        const p0 = ps[0];
        const p1 = ps[ps.length - 1];

        const dx = p1[0] - p0[0];
        const dy = p1[1] - p0[1];

        const l = hypot(dx, dy);

        L.push(l);
        rawPhi.push(l < EPS ? NaN : atan2(dy, dx));
        // if (l === 0) { console.log(ps)}
    }

    // degenerate angles from the nearest real one; 0 if there is none
    const phi = fillGaps(rawPhi, Number.isNaN)
        .map(φ => Number.isNaN(φ) ? 0 : φ);

    return { L, phi };
}


export { chords }
