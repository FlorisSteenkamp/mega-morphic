/**
 * Returns `vals` padded to length `m` by repeating its last value (0 if
 * empty) - e.g. per-segment chord angles padded to per-boundary length.
 */
function padTo(
        vals: number[],
        m: number): number[] {

    const out = vals.slice();
    while (out.length < m) { out.push(out[out.length - 1] ?? 0); }

    return out;
}


export { padTo }
