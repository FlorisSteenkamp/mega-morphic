import type { MorphEntry } from './morph-entry.js';
import { getShapeArea } from 'flo-boolean';
import { getDiskChainEnvelope } from './get-disk-chain-envelope.js';
import { getLastP } from './get-last-p.js';
import { reverseShapeOrientation } from 'flo-boolean';
import { pAtIndex } from './shape/p-at-idx.js';
import { reconstructOutline } from './reconstruct-outline.js';

const { atan2, min, max, cos, sin, abs, ceil, PI: π } = Math;


interface ResolvedMorph {
    /** per entry: its drawn (lerped + glued) beziers */
    readonly drawn: number[][][][];
    /** per entry: its lerped boundary radii (undefined if entry has none) */
    readonly radii: (number[] | undefined)[];
    readonly outlines: number[][][][];
}


/**
 * Resolves every morph entry at `t` ∈ [0,1]: control points lerped, glue
 * applied (junctions riding their parents' drawn skeletons), radii lerped,
 * and the coarse boundary computed as the union of all disk envelopes.
 */
function resolveMorphAt(
        entries: MorphEntry[],
        t: number): ResolvedMorph {

    // Drawn (post-glue) beziers per entry; parents resolved on demand.
    const drawn: (number[][][] | undefined)[] = entries.map(() => undefined);

    const getDrawn_ = getDrawn(t, entries, drawn);

    const radii: (number[] | undefined)[] = [];
    const outlines: number[][][][] = [];
    for (let i = 0; i < entries.length; i++) {
        const { ra, rb } = entries[i];
        if (ra === undefined || rb === undefined) {
            radii.push(undefined);
            getDrawn_(i);
            continue;
        }

        const rs = ra.map((r, k) => r*(1 - t) + rb[k]*t);
        radii.push(rs);

        // Residual-corrected outline; bare disk envelope as fallback.
        const loop =
            // reconstructOutline(entries[i], getDrawn_(i), rs, t)
            // ??
            getDiskChainEnvelope(getDrawn_(i), rs);

        if (loop === undefined) { continue; }

        // The union is winding-number based - orient all loops alike.
        outlines.push(getShapeArea(loop) < 0 ? reverseShapeOrientation(loop) : loop);
    }

    return {
        drawn: drawn as number[][][][],
        radii,
        outlines
    };
}


/**
 * Returns a memoized resolver that computes an entry's drawn beziers at `t`:
 * control points lerped between frames `a` and `b`, then, if the entry is
 * glued, translated so its endpoint rides its parent's drawn skeleton
 * (parents are resolved recursively on demand). Results are cached in `drawn`.
 */
function getDrawn(
        t: number,
        entries: MorphEntry[],
        drawn: (number[][][] | undefined)[]) {

    return getDrawn_;

    function getDrawn_(i: number): number[][][] {
        const cached = drawn[i];
        if (cached !== undefined) { return cached; }

        const { a, b, glue } = entries[i];

        let bz = a.map((ps, k) =>
            ps.map((p, j) => p.map((c, d) =>
                c * (1 - t) + b[k][j][d] * t)));

        if (glue !== undefined) {
            let target: number[];
            if (glue.e1 === glue.e2) {
                // Junction slides along the one parent from k1 to k2.
                target = pAtIndex(
                    getDrawn_(glue.e1), (1 - t)*glue.k1 + t*glue.k2
                );
            } else {
                // Attached to different branches per frame: blend between
                // the two attachment points' drawn positions.
                const p1 = pAtIndex(getDrawn_(glue.e1), glue.k1);
                const p2 = pAtIndex(getDrawn_(glue.e2), glue.k2);
                target = [
                    (1 - t)*p1[0] + t*p2[0],
                    (1 - t)*p1[1] + t*p2[1]
                ];
            }

            const base = getLastP(bz);
            const dx = target[0] - base[0];
            const dy = target[1] - base[1];
            bz = bz.map(ps => ps.map(p => [p[0] + dx, p[1] + dy]));
        }

        drawn[i] = bz;
        return bz;
    }
}


export { resolveMorphAt }
export type { ResolvedMorph }
