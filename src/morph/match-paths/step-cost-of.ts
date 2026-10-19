
const { abs, PI: π } = Math;


/**
 * Returns the cost of matching one profile sample against another, for one
 * (diagonal) alignment step.
 *
 * * radius difference + mirror-invariant turning difference (|turn| is
 *   compared), the latter weighted by the mean local radius so both terms
 *   price DISAGREEMENT AREA (salience fraction) - bends in fat regions
 *   matter more than in thin ones
 * * integrated over the step's normalized arc length `diagStep`
 *
 * @param diagStep the normalized arc length of a diagonal step
 * @param radius the radius-difference weight
 * @param turning the turning-difference weight
 */
function stepCostOf(
        diagStep: number,
        radius: number,
        turning: number) {

    return function(
            rA: number, rB: number,
            tA: number, tB: number): number {

        return diagStep * (
            radius*abs(rA - rB) +
            turning*((rA + rB)/2)*abs(abs(tA) - abs(tB)) / (2*π)
        );
    }
}


export { stepCostOf }
