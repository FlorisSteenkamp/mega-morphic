import { chords } from './chords.js';
import { sum } from '../../utils/sum.js';

const { max, min } = Math;


/**
 * Returns how far a morphing skeleton's angles have turned from frame `a`
 * to frame `b` at `t`: `t·wb / ((1 - t)·wa + t·wb)`, with each frame's
 * direction weight `w = min(1, L/r)` - its chord length `L` against its
 * stroke width (its largest maximal-disk radius `r`).
 *
 * * a frame at least as long as it is thick has a real direction (`w = 1`):
 *   between two such frames the angles turn evenly (`t`), whatever their
 *   length ratio
 *
 * * a frame shorter than that is (nearly) a blob, whose direction means
 *   little: a branch shrinking to such a nub keeps its own direction while
 *   it retracts and turns only at the very end, once too short to see; one
 *   growing from it grows out in its final direction - instead of being
 *   rotated halfway when half of it is left
 *
 * * exact at `t` = 0 and 1; `t` when both weights are 0
 *
 * @param a the skeleton beziers in frame a
 * @param b the corresponding skeleton beziers in frame b
 * @param ra the maximal-disk radii of frame a
 * @param rb the maximal-disk radii of frame b
 * @param t the morph parameter
 */
function calcAngleProgress(
        a: number[][][],
        b: number[][][],
        ra: number[],
        rb: number[],
        t: number): number {

    const wa = calcDirWeight(a, ra);
    const wb = calcDirWeight(b, rb);
    const w = (1 - t)*wa + t*wb;

    return w === 0 ? t : t*wb/w;
}


/**
 * Returns how much a frame's direction counts: its chord length against its
 * stroke width, at most `1` (`calcAngleProgress`).
 */
function calcDirWeight(
        pss: number[][][],
        rs: number[]): number {

    const L = sum(chords(pss).L);
    const r = max(0, ...rs);

    return r === 0 ? 1 : min(1, L/r);
}


export { calcAngleProgress }
