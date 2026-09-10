import { evalDeCasteljau } from "flo-bezier3";

const { min, max, floor } = Math;


/**
 * The point at fractional segment-boundary index `kf` along a bezier path.
 */
function pAtIndex(
        bz: number[][][],
        kf: number): number[] {

    const j = max(0, min(bz.length - 1, floor(kf)));

    return evalDeCasteljau(bz[j], max(0, min(1, kf - j)));
}


export { pAtIndex }
