
function nearestIdx(pts: number[][], p: number[]): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
        const d = dist2(pts[i], p);
        if (d < bestD) { bestD = d; best = i; }
    }

    return best;
}


function dist2(p: number[], q: number[]) {
    return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
}


export { nearestIdx }
