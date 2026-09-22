import { totalLength$ } from './fs/total-length.js';

const { abs } = Math;


/**
 * Index of the skeleton knot (= slice start) nearest arc distance `d`.
 */
function skeletonKnotIndexAt(
        pss: number[][][],
        d: number): number {

    let cum = 0;
    let best = 0;
    let bestDiff = abs(d);
    for (let i=0; i<pss.length; i++) {
        cum += totalLength$(pss[i]);
        const diff = abs(cum - d);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = i + 1;
        }
    }

    return best;
}


export { skeletonKnotIndexAt }
