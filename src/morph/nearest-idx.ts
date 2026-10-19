import { squaredDistanceBetween } from 'flo-vector2d';


function nearestIdx(pts: number[][], p: number[]): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
        const d = squaredDistanceBetween(pts[i], p);
        if (d < bestD) { bestD = d; best = i; }
    }

    return best;
}


export { nearestIdx }
