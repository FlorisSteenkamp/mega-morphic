/**
 * Returns the minimum-cost alignment of a cyclic sequence `as` against a
 * sequence (`alignLinear` closes over it), by aligning rotations of `as`
 * linearly.
 *
 * * tries the rotations by `0` up to `maxRot - 1` (all of them when
 *   `maxRot` is `as.length`) and keeps the cheapest (the first on a tie, so
 *   the unrotated alignment wins when wrapping gains nothing)
 *
 * * trying all rotations is exact for order-preserving alignments: an
 *   optimal cyclic alignment can always be cut where the other sequence
 *   starts, and what precedes the cut in `as` is one of its rotations
 *
 * * also returns the winning rotation of `as` (the linear result is in its
 *   order)
 *
 * @param as the cyclic sequence (cut anywhere)
 * @param maxRot the number of rotations to try (at least `1`)
 * @param alignLinear aligns one rotation of `as` linearly
 */
function alignCyclic<A, R extends { readonly cost: number }>(
        as: A[],
        maxRot: number,
        alignLinear: (as: A[]) => R): R & { as: A[] } {

    let best = { ...alignLinear(as), as };

    for (let k = 1; k < maxRot; k++) {
        const rot = [...as.slice(k), ...as.slice(0, k)];
        const aligned = alignLinear(rot);
        if (aligned.cost < best.cost) {
            best = { ...aligned, as: rot };
        }
    }

    return best;
}


export { alignCyclic }
