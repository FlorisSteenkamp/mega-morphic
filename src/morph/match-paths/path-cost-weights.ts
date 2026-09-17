/**
 * Relative importance of each (dimensionless) cost term - all tunable.
 */
interface PathCostWeights {
    /** profile (radius + turning) mismatch, scaled by matched length */
    readonly shape: number;
    /** fork position mismatch along the paths */
    readonly position: number;
    /** fork emanating-angle mismatch */
    readonly angle: number;
    /** unmatched subtree delete/insert (per salience fraction) */
    readonly del: number;
    /** flat delete/insert floor (small branches aren't free to drop) */
    readonly delFloor: number;
    /** off-path leaf-side stub (per salience fraction) */
    readonly stub: number;
    /** unmatched leaf tail (per normalized length) */
    readonly tail: number;
    /**
     * Trunk total-turning mismatch (orientation decision only).
     * A 180 degree turn imposes a penalty of `1` times `turn`
     */
    readonly turn: number;
    /** trunk absolute-orientation swing (mean chord-angle difference) -
     *  penalizes trunk pairings that make the whole morph rotate */
    readonly sway: number;
    /** interior alignment gap open/extend (profile samples) */
    readonly gapOpen: number;
    readonly gapExtend: number;
}


export type { PathCostWeights }