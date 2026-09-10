
function getLastP(bz: number[][][]): number[] {
    const seg = bz[bz.length - 1];
    return seg[seg.length - 1];
}


export { getLastP }