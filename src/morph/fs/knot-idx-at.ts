/**
 * Returns the index `j` of the knot interval `[knots[j], knots[j+1]]`
 * containing normalized position `u` (clamped to the first/last interval).
 *
 * * pass an interval's midpoint to find the one original segment
 *   containing it
 */
function knotIdxAt(
        knots: number[],
        u: number): number {

    let j = 0;
    while (j < knots.length - 2 && knots[j + 1] <= u) { j++; }

    return j;
}


export { knotIdxAt }
