
/**
 * The bezier's (unnormalized) direction at its start: from the first
 * control point to the first one distinct from it; `[0,0]` if the bezier
 * is a single point.
 */
function dirAtStart(ps: number[][]): number[] {
    const p0 = ps[0];
    for (let i = 1; i < ps.length; i++) {
        const [x, y] = [ps[i][0] - p0[0], ps[i][1] - p0[1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];
}


export { dirAtStart }
