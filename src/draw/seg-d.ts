
/**
 * The SVG path command (`L`, `Q` or `C`, with trailing space) continuing a
 * subpath along the given line / quadratic / cubic bezier from its start.
 */
function segD(ps: number[][]): string {
    const [,p1,p2,p3] = ps;

    return ps.length === 2
        ? `L ${p1[0]} ${p1[1]} `
        : ps.length === 3
        ? `Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} `
        : `C ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]} `;
}


export { segD }
