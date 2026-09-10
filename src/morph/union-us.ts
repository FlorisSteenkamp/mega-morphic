
/** Union of sorted position lists, deduped, ascending. */
function unionUs(
        ...lists: number[][]): number[] {

    const all = lists.flat().sort((a, b) => a - b);
    const out: number[] = [];
    for (const u of all) {
        if (out.length === 0 || u - out[out.length - 1] > 1e-9) {
            out.push(u);
        }
    }
    return out;
}


export { unionUs }
