import { length } from 'flo-bezier3';


/** Index of the skeleton knot (= slice start) nearest arc distance `d`. */
function edgeIndexAt(bz: number[][][], d: number): number {
    let cum = 0;
    let best = 0;
    let bestDiff = Math.abs(d);
    for (let j = 1; j <= bz.length; j++) {
        cum += length([0, 1], bz[j - 1]);
        const diff = Math.abs(cum - d);
        if (diff < bestDiff) { bestDiff = diff; best = j; }
    }
    return best;
}


export { edgeIndexAt }
