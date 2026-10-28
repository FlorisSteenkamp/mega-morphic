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
    /** trunk LOCAL sway (× shape anisotropy): material-weighted mean local
     *  orientation difference of corresponded samples, MEASURED along each
     *  trunk candidate's optimal intrinsic DTW warp (objective-neutral - see
     *  `productDtw`). Added to trunk candidate ranking/selection - pairings
     *  whose corresponded material would visibly rotate lose to
     *  same-orientation ones */
    readonly sway: number;
    /**
     * child LOCAL sway: as `sway`, measured along a child pair's sub-DTW
     * warp in its parent's frame (the child's rotation relative to its
     * parent) - added to the child relabel price, times the pair's size
     * factor
     *
     * * separate from the trunk's: a limb turning against its parent reads
     *   as a bend in the morph, far less jarring than the whole glyph
     *   spinning (and the turning profile and fork angle already price part
     *   of such a bend)
     *
     * * not scaled by the glyphs' anisotropy: that only says whether the
     *   glyph as a whole has an orientation - a limb's turn against its
     *   parent shows however round the glyph is
     */
    readonly childSway: number;
}


const defaultPathWeights: PathCostWeights = {
    radius: 1,
    turning: 0.15,
    position: 3,
    angle: 0.25,
    del: 3,
    sway: 3,
    childSway: 1,
    gapOpen: 0.15,
    gapExtend: 0.06
};


export { defaultPathWeights }


export type { PathCostWeights }