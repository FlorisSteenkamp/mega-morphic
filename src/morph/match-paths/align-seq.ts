type SeqOp<A, B> =
    | { type: 'match'; a: A; b: B }
    | { type: 'delete'; a: A }
    | { type: 'insert'; b: B };


/** Finds the minimum-cost monotone match, delete and insert operations. */
function alignSeq<A, B>(
        as: A[],
        bs: B[],
        mCost: (a: A, b: B) => number,
        dCost: (a: A) => number,
        iCost: (b: B) => number): { cost: number; ops: SeqOp<A, B>[] } {

    const n = as.length;
    const m = bs.length;

    const D: number[][] = [];
    for (let i = 0; i <= n; i++) { D.push(new Array(m + 1).fill(0)); }
    for (let i = 1; i <= n; i++) { D[i][0] = D[i - 1][0] + dCost(as[i - 1]); }
    for (let j = 1; j <= m; j++) { D[0][j] = D[0][j - 1] + iCost(bs[j - 1]); }

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            D[i][j] = Math.min(
                D[i - 1][j - 1] + mCost(as[i - 1], bs[j - 1]),
                D[i - 1][j] + dCost(as[i - 1]),
                D[i][j - 1] + iCost(bs[j - 1])
            );
        }
    }

    const ops: SeqOp<A, B>[] = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 &&
            D[i][j] === D[i - 1][j - 1] + mCost(as[i - 1], bs[j - 1])) {
            ops.push({ type: 'match', a: as[i - 1], b: bs[j - 1] });
            i--; j--;
        } else if (i > 0 && D[i][j] === D[i - 1][j] + dCost(as[i - 1])) {
            ops.push({ type: 'delete', a: as[i - 1] });
            i--;
        } else {
            ops.push({ type: 'insert', b: bs[j - 1] });
            j--;
        }
    }
    ops.reverse();

    return { cost: D[n][m], ops };
}


export { alignSeq }