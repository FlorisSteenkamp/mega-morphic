
function getNearest<T>(
        f: (p: number[], t: T) => number,
        ts: T[],
        p: number[]): { d: number, t: T } {

    let minD = Infinity;
    let minT: T = undefined!;
    for (const t of ts) {
        const d = f(p,t);
        if (d < minD) {
            minD = d;
            minT = t;
        }
    }

    return { d: minD, t: minT };
}


export { getNearest }
