import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';


/**
 * Returns the total turning angle of a poly-bezier curve.
 * 
 * * e.g. a spiral going around thrice will have a total turning angle of 6*π
 */
function getPolyBezierTurningAngle(
        pss: number[][][]): number {

    const ψs = unwrappedChordAngles(pss);

    return ψs.length <= 1
        ? 0
        : ψs[ψs.length - 1] - ψs[0];
}


export { getPolyBezierTurningAngle }
