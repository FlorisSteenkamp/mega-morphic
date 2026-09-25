import type { MorphEntry } from '../morph-entry.js';
import { getShapeArea } from 'flo-boolean';
import { reverseShapeOrientation } from 'flo-boolean';
import { getMorphedSkeleton } from './get-morphed-skeleton.js';
import { getMorphedBoundary } from './get-morphed-boundary/get-morphed-boundary.js';


interface ResolvedMorph {
    /** per entry: its drawn (lerped + glued) beziers */
    readonly drawn: number[][][][];
    /** per entry: its lerped boundary radii (undefined if entry has none) */
    readonly radii: (number[] | undefined)[];
    readonly outlines: number[][][][];
}


/**
 * Resolves every morph entry at `t` ∈ [0,1]
 *
 * * control points lerped
 * * glue applied (junctions riding their parents' drawn skeletons)
 * * radii lerped
 * * outline built by lerping the entry's original boundary sleeves
 *   all as loops ready for a winding-number union.
 */
function resolveMorphAt(
        entries: MorphEntry[],
        t: number): ResolvedMorph {

    // Drawn (post-glue) beziers per entry; parents resolved on demand.
    const skels: (number[][][] | undefined)[] = entries.map(() => undefined);
    const radii: (number[] | undefined)[] = [];
    const outlines: number[][][][] = [];

    for (let i=0; i<entries.length; i++) {
        const { ra, rb } = entries[i];
        if (ra === undefined || rb === undefined) {
            radii.push(undefined);
            skels[i] = getMorphedSkeleton(entries, t, i).pss;
            continue;
        }

        const rs = ra.map((r, k) => r*(1 - t) + rb[k]*t);
        radii.push(rs);

        // Boundary anchored to the drawn maximal disks, shape lerped on top;
        // bare disk envelope as fallback.
        skels[i] = getMorphedSkeleton(entries, t, i).pss;
        const loop = getMorphedBoundary(entries[i], skels[i]!, rs, t);

        if (loop === undefined) { continue; }

        // The union is winding-number based - orient all loops alike.
        outlines.push(getShapeArea(loop) < 0
            ? reverseShapeOrientation(loop)
            : loop
        );
    }

    return {
        drawn: skels as number[][][][],
        radii,
        outlines
    };
}


export { resolveMorphAt }
export type { ResolvedMorph }
