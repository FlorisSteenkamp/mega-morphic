import type { MorphEntry } from '../morph-entry.js';
import type { Pose } from './pose.js';
import { calcProcrustes$ } from './calc-procrustes.js';
import { resolveMorphAt } from '../resolve-morph-at/resolve-morph-at.js';
import { mainOutlinesOf } from './main-outlines-of.js';


/**
 * Returns the `Pose` in the DRAW-TIME metric
 * 
 * * this live measurement (procrustes over the per-entry outlines) overcounts
 * seam overlaps vs the true single loop - inflating the area and pulling the
 * centroid toward the junctions.
 * 
 * * Using the same metric for the endpoints makes the bias cancel exactly at
 * t=0/1 (and approximately in between). It also makes the alignment pivot
 * (centroidB) the very point the live correction scales about at t=1 -
 * with a true-loop pivot, `scale` alone would leave B shifted by
 * (1 - 1/s)·(soup centroid - loop centroid).
 * 
 * * Measured on the UNALIGNED entries: resolving is translation/scale
 * equivariant, so the aligned entries' t=1 pose is just this one mapped.
 *
 * * Measured over the matched components only (`mainOutlinesOf`) - the
 * same loops the live correction measures.
 */
function calcPoseAt(
        entries: MorphEntry[],
        t: number): Pose {

    const resolved = resolveMorphAt(entries, t);

    return calcProcrustes$(mainOutlinesOf(entries, resolved).flat());
}


export { calcPoseAt }
