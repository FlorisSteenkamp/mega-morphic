import type { PathGeom } from './path-geom.js';
import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';
import { totalLength$ } from '../fs/total-length.js';

const { abs, PI: π } = Math;


/**
 * Absolute-orientation swing of the pairing: how much the whole morph
 * would rotate (the intrinsic lerp sweeps the orientation difference).
 */
function swayTerm(
        sway: number) {

    return function(
            pA: PathGeom,
            pB: PathGeom): number {

        return sway * abs(wrapAngle(
            meanAngle(pB.skelPss) - meanAngle(pA.skelPss)
        )) / π;
    }
}


/**
 * Arc-length-weighted mean chord angle - the path's absolute orientation.
 */
function meanAngle(
        bz: number[][][]): number {

    const ψs = unwrappedChordAngles(bz);
    let sum = 0;
    let total = 0;
    for (let i=0; i<bz.length; i++) {
        const l = totalLength$(bz[i]);
        sum += ψs[i] * l;
        total += l;
    }
    return total === 0 ? 0 : sum / total;
}


export { swayTerm }