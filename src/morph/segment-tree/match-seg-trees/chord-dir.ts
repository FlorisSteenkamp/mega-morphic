import type { Segment } from '../segment.js';
import { geomOf$ } from '../geom-of.js';


/** Chord direction of a segment's first/last bezier, optionally reversed. */
function chordDir(
        seg: Segment,
        which: 'start' | 'end' | 'startRev' | 'endRev'): number[] {

    const { skelPss } = geomOf$(seg);
    const atStart = which === 'start' || which === 'startRev';
    const ps = atStart ? skelPss[0] : skelPss[skelPss.length - 1];
    const p0 = ps[0];
    const p1 = ps[ps.length - 1];
    const rev = which === 'startRev' || which === 'endRev';
    return rev
        ? [p0[0] - p1[0], p0[1] - p1[1]]
        : [p1[0] - p0[0], p1[1] - p0[1]];
}


export { chordDir }
