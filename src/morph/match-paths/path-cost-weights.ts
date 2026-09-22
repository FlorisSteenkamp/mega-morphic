/**
 * Relative importance of each (dimensionless) cost term - all tunable.
 *
 * Grouped by the cost class they feed (see `matchPathPair` / `matchPaths`):
 * profile alignment (DTW), reroute stubs, pooled children, trunk orientation.
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
    // --- reroute stubs: stubCost ---
    //------------------------------------------------------
    /** off-path leaf-side stub (per salience fraction) */
    readonly stub: number;

    // --- pooled children: childCost (delFloor also feeds stubCost) ---
    /** unmatched subtree delete/insert (per salience fraction) */
    readonly del: number;
    /** flat delete/insert floor (small branches aren't free to drop) */
    readonly delFloor: number;
    /** fork position mismatch along the paths */
    readonly position: number;
    /** fork emanating-angle mismatch */
    readonly angle: number;

    //------------------------------------------------------
    // --- trunk orientation (matchPaths only) ---
    //------------------------------------------------------
    /**
     * Trunk total-turning mismatch (orientation decision only).
     * A 180 degree turn imposes a penalty of `1` times `turn`
     */
    readonly turn: number;
    /** trunk absolute-orientation swing (mean chord-angle difference) -
     *  penalizes trunk pairings that make the whole morph rotate */
    readonly sway: number;
}


export type { PathCostWeights }