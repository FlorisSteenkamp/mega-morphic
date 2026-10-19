
/**
 * Returns a copy of `xs` with each gap replaced by its nearest non-gap
 * neighbor: a forward fill (from the left), then a backward fill (for
 * leading gaps). All-gap input stays all gaps.
 *
 * @param xs
 * @param isGap which values are gaps (e.g. degenerate directions)
 */
function fillGaps<T>(xs: readonly T[], isGap: (x: T) => boolean): T[] {
    const out = [...xs];

    for (let k = 1; k < out.length; k++) {
        if (isGap(out[k])) { out[k] = out[k - 1]; }
    }
    for (let k = out.length - 2; k >= 0; k--) {
        if (isGap(out[k])) { out[k] = out[k + 1]; }
    }

    return out;
}


export { fillGaps }
