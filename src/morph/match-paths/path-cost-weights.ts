/**
 * Relative importance of each (dimensionless) cost term - all tunable.
 *
 * Grouped by the cost class they feed (see `productDtw` /
 * `matchSegTrees`): profile alignment (DTW), pooled children, trunk
 * orientation.
 */
interface PathCostWeights {
    //------------------------------------------------------
    // --- profile alignment (DTW): shapeCost ---
    //------------------------------------------------------
    /** radius-profile mismatch, scaled by matched length */
    readonly radius: number;
    /** turning-rate-profile mismatch, scaled by matched length */
    readonly turning: number;
    /** interior alignment gap open (profile samples) */
    readonly gapOpen: number;
    /** interior alignment gap extend (profile samples) */
    readonly gapExtend: number;

    //------------------------------------------------------
    // --- pooled children: childCost ---
    //------------------------------------------------------
    /** unmatched subtree delete/insert (per salience fraction) */
    readonly del: number;
    /** flat delete/insert floor (small branches aren't free to drop) */
    readonly delFloor: number;
    /**
     * fork position mismatch through the routes' profile correspondence,
     * per feature interval moved (`calcWarpPosCost`; the cheap estimate
     * still uses the whole-outline position)
     */
    readonly position: number;
    /** fork emanating-angle mismatch */
    readonly angle: number;

    //------------------------------------------------------
    // --- orientation (trunk selection + child relabel) ---
    //------------------------------------------------------
    /** LOCAL sway (× shape anisotropy): material-weighted mean local
     *  orientation difference of corresponded samples, MEASURED along each
     *  candidate's optimal intrinsic DTW warp (objective-neutral - see
     *  `productDtw`). Added to trunk candidate ranking/selection and to the
     *  child relabel price - pairings whose corresponded material would
     *  visibly rotate lose to same-orientation ones / drops */
    readonly sway: number;
}


const defaultPathWeights: PathCostWeights = {
    radius: 1,
    turning: 0.15,
    position: 2,
    angle: 0.25,
    del: 3,
    delFloor: 0,
    sway: 3,
    gapOpen: 0.15,
    gapExtend: 0.06
};


export { defaultPathWeights }


export type { PathCostWeights }