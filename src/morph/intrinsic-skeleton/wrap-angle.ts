
const { PI: π } = Math;

const τ = 2*π;


/**
 * Wraps an angle in radians to [-π, π), preserving its direction modulo a
 * full turn.
 * 
 * Applied to an angle difference, the result is the shortest
 * signed rotation between the two directions.
 */
function wrapAngle(
        θ: number): number {

    return ((θ + π)%τ + 2*π)%τ - π;
}


export { wrapAngle }
