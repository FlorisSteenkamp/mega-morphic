import { evalDeCasteljau } from "flo-bezier3";
import { clamp } from "../../utils/clamp";

const { min, max, floor } = Math;


/**
 * The point at fractional segment-boundary index `kf` along a bezier path.
 */
function pAtIndex(
        bz: number[][][],
        kf: number): number[] {

    const j = clamp(floor(kf), 0, bz.length - 1);

    return evalDeCasteljau(bz[j], clamp(kf - j, 0, 1));
}


export { pAtIndex }
