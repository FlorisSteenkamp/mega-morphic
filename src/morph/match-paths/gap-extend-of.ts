/**
 * The reference stroke radius (normalized by the glyph unit) at which a
 * gapped sample costs `gapExtend` per unit of length - about the mean
 * sampled radius of the test glyphs (0.044 - 0.135, mean 0.088)
 */
const GAP_R_REF = 0.09;


/**
 * Returns a function giving the cost of gapping a profile's sample `i`:
 * `gapExtend` per unit of length, scaled by the sample's radius relative to
 * `GAP_R_REF` - i.e. by its material, as drops and coverage are priced.
 *
 * * so a skipped thin tip costs less than a skipped fat stretch, and a small
 *   branch's gaps scale with its size like all its other costs
 *
 * @param gapExtend the gap extension weight
 * @param step the profile's length per sample (normalized)
 * @param r the profile's radii (normalized)
 */
function gapExtendOf(
        gapExtend: number,
        step: number,
        r: ArrayLike<number>) {

    return function(i: number): number {
        return gapExtend*step*r[i]/GAP_R_REF;
    }
}


export { gapExtendOf }
