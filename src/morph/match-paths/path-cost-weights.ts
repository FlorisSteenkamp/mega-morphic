/**
 * Relative importance of each (dimensionless) cost term - all tunable.
 *
 * Grouped by the cost class they feed (see `productDtw` / `matchSegGraphs` /
 * `alignProfiles`): profile alignment (DTW), pooled children, trunk
 * orientation.
 */
interface PathCostWeights {
    //------------------------------------------------------
    // --- profile alignment (DTW): shapeCost + tailCost ---
    //------------------------------------------------------
    /** radius-profile mismatch, scaled by matched length */
    readonly radius: number;
    /** turning-rate-profile mismatch, scaled by matched length */
    readonly turning: number;
    /** interior alignment gap open (profile samples) */
    readonly gapOpen: number;
    /** interior alignment gap extend (profile samples) */
    readonly gapExtend: number;
    /** unmatched leaf tail (per normalized length) */
    readonly tail: number;

    //------------------------------------------------------
    // --- pooled children: childCost ---
    //------------------------------------------------------
    /** unmatched subtree delete/insert (per salience fraction) */
    readonly del: number;
    /** flat delete/insert floor (small branches aren't free to drop) */
    readonly delFloor: number;
    /** fork position mismatch along the paths */
    readonly position: number;
    /** fork emanating-angle mismatch */
    readonly angle: number;

    //------------------------------------------------------
    // --- trunk orientation ---
    //------------------------------------------------------
    /** trunk absolute-orientation swing (mean chord-angle difference ×
     *  shape anisotropy) - near-tie trunk pairings resolve toward the one
     *  that makes the whole morph rotate least */
    readonly sway: number;
}


const defaultPathWeights: PathCostWeights = {
    radius: 1,
    turning: 0.15,
    position: 0.5,
    angle: 0.25,
    del: 3,
    delFloor: 0.15,
    tail: 0.5,
    sway: 2,
    gapOpen: 0.15,
    gapExtend: 0.06
};


export { defaultPathWeights }


export type { PathCostWeights }