
/**
 * The bezier's (unnormalized) direction at its end: from the last control
 * point distinct from the end point to the end point; `[0,0]` if the
 * bezier is a single point.
 */
function dirAtEnd(ps: number[][]): number[] {
    const pE = ps[ps.length - 1];
    for (let i = ps.length - 2; i >= 0; i--) {
        const [x, y] = [pE[0] - ps[i][0], pE[1] - ps[i][1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];
}


export { dirAtEnd }
