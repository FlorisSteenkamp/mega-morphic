import type { PathGeom } from './path-geom.js';
import { length } from 'flo-bezier3';
import { unwrappedChordAngles } from '../intrinsic-skeleton/intrinsic-skeleton.js';
import { wrapAngle } from '../intrinsic-skeleton/wrap-angle.js';

const { abs, PI: π } = Math;


// Absolute-orientation swing of the pairing: how much the whole morph
// would rotate (the intrinsic lerp sweeps the orientation difference).
function swayTerm(
        pA: PathGeom,
        pB: PathGeom,
        sway: number): number {

    return sway * abs(wrapAngle(
        meanAngle(pB.bz) - meanAngle(pA.bz)
    )) / π;
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
        const l = length([0, 1], bz[i]);
        sum += ψs[i] * l;
        total += l;
    }
    return total === 0 ? 0 : sum / total;
}


export { swayTerm }