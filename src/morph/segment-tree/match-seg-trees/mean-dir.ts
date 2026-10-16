const { hypot } = Math;


/** Mean of two directions (unit-normalized sum); falls back on either
 *  when the other is zero or they cancel. */
function meanDir(d1: number[], d2: number[]): number[] {
    const l1 = hypot(d1[0], d1[1]);
    const l2 = hypot(d2[0], d2[1]);
    if (l1 === 0) { return d2; }
    if (l2 === 0) { return d1; }
    const mx = d1[0]/l1 + d2[0]/l2;
    const my = d1[1]/l1 + d2[1]/l2;
    return hypot(mx, my) < 1e-9 ? d1 : [mx, my];
}


export { meanDir }
