import type { MorphEntry } from '../morph-entry.js';
import type { Pose } from './pose.js';
import { mapmap } from '../../utils/map-map.js';
import { poseCorrectionAt } from './pose-ramp.js';


/**
 * Returns fresh entries with shape B's frame aligned onto shape A: every
 * B-frame coordinate scaled by `poseA.scale/poseB.scale` about B's centroid,
 * then moved onto A's centroid, and B's radii scaled to match
 *
 * * NO rotation - the intrinsic skeleton lerp already plays orientation out
 *   linearly
 * * the sleeve data is stored in local frames (chord-normalized pieces,
 *   polar anchors), so the reconstruction stays exact
 * * pure - untouched fields (sleeves, glue, A-frame) are shared by
 *   reference; glue targets entries by INDEX, preserved by map
 * * the true pose is restored over t at draw time (see `poseCorrectionAt`)
 */
function alignEntriesBToA(
        entries: MorphEntry[],
        poseA: Pose,
        poseB: Pose): MorphEntry[] {

    const { scale: scaleA } = poseA;
    const { scale: scaleB } = poseB;

    const scale = scaleA/scaleB;

    // B's frame onto A's = the pose correction at t=0 of B's own pose
    // (centroid B → A, scale × scaleA/scaleB)
    const bToAFrame = poseCorrectionAt({ poseA, poseB }, 0, poseB);

    return entries.map(e => {
        // Deleted (A-side) topo entries live entirely in shape A's frame.
        if (e.collapsed === 'b') {
            return e;
        }

        return {
            ...e,
            // An inserted entry's collapsed frame is in shape B's coords too.
            ...(e.collapsed === 'a'
                ? { skelPssA: mapmap(e.skelPssA, bToAFrame) }
                : {}
            ),
            skelPssB: mapmap(e.skelPssB, bToAFrame),
            rb: e.rb.map(r => r * scale)
        };
    });
}


export { alignEntriesBToA }
