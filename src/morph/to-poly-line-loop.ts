
/** Closed loop of 2-point beziers, skipping degenerate (short) edges. */
function toPolylineLoop(pts: number[][]): number[][][] | undefined {
    const kept: number[][] = [];
    for (const p of pts) {
        const q = kept[kept.length - 1];
        if (q === undefined || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) {
            kept.push(p);
        }
    }
    if (kept.length > 1) {
        const p = kept[0];
        const q = kept[kept.length - 1];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= 1e-6) { kept.pop(); }
    }
    if (kept.length < 3) { return undefined; }

    const loop: number[][][] = [];
    for (let i = 0; i < kept.length; i++) {
        loop.push([kept[i], kept[(i + 1) % kept.length]]);
    }
    return loop;
}


export { toPolylineLoop }
