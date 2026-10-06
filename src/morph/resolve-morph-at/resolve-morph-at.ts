import type { MorphEntry } from '../morph-entry.js';
import { getShapeArea } from 'flo-boolean';
import { reverseShapeOrientation } from 'flo-boolean';
import { getMorphedSkeleton } from './get-morphed-skeleton.js';
import { getMorphedBoundary } from './get-morphed-boundary/get-morphed-boundary.js';


interface ResolvedMorph {
    /** per entry: its drawn (lerped + glued) beziers */
    readonly drawn: number[][][][];
    readonly outlines: number[][][][];
    /** per outline loop: the entry index it belongs to */
    readonly outlineEntry: number[];
}


/**
 * Resolves every morph entry at `t` ∈ [0,1]
 *
 * * skeleton lerped intrinsically, glue applied (junctions riding their
 *   parents' drawn skeletons)
 * * radii lerped
 * * outline built by lerping the entry's original boundary sleeves
 *   all as loops ready for a winding-number union.
 */
function resolveMorphAt(
        entries: MorphEntry[],
        t: number): ResolvedMorph {

    const drawn: number[][][][] = [];
    const outlines: number[][][][] = [];
    const outlineEntry: number[] = [];

    for (let i=0; i<entries.length; i++) {
        const { ra, rb } = entries[i];
        const rs = ra.map((r, k) => r*(1 - t) + rb[k]*t);

        // Boundary anchored to the drawn maximal disks, shape lerped on top.
        const pss = getMorphedSkeleton(entries, t, i).pss;
        drawn.push(pss);
        const loop = getMorphedBoundary(entries[i], pss, rs, t);

        if (loop === undefined) { continue; }

        // The union is winding-number based - orient all loops alike.
        outlines.push(getShapeArea(loop) < 0
            ? reverseShapeOrientation(loop)
            : loop
        );
        outlineEntry.push(i);
    }

    return { drawn, outlines, outlineEntry };
}


export { resolveMorphAt }
export type { ResolvedMorph }
