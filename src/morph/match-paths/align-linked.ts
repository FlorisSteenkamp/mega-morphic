import type { SeqOp } from './align-seq.js';


/**
 * Returns the minimum-cost monotone match, delete and insert operations of
 * two sequences, where consecutive matches are also priced by how well they
 * link up.
 *
 * * total = the matches' own costs + the dropped items' costs + a link cost
 *   for each consecutive pair of matches, from an anchor before the first
 *   match and back to it after the last (`link(undefined, q)` and
 *   `link(p, undefined)`)
 *
 * * an alignment without matches costs only its drops
 *
 * * a dynamic program over the last match: `D[i][j]` is the least cost of
 *   the prefixes `as[0..i)` / `bs[0..j)` that end by matching `as[i-1]`
 *   with `bs[j-1]` (`Infinity` in row/column 0) - O(n²m²)
 *
 * * also returns the summed link costs of the winning alignment (`linkCost`)
 *
 * * link costs must not be negative (a candidate previous match is skipped
 *   once its cost before the link already loses)
 *
 * @param as the first sequence
 * @param bs the second sequence
 * @param matchCost the cost of matching `a` with `b` (`Infinity` = never)
 * @param delCost the cost of deleting `a`
 * @param insCost the cost of inserting `b`
 * @param link the cost of the link from match `p` to match `q`
 */
function alignLinked<A, B>(
        as: A[],
        bs: B[],
        matchCost: (a: A, b: B) => number,
        delCost: (a: A) => number,
        insCost: (b: B) => number,
        link: (p: [A, B] | undefined, q: [A, B] | undefined) => number):
        { cost: number; ops: SeqOp<A, B>[]; D: number[][]; linkCost: number } {

    const n = as.length;
    const m = bs.length;

    // prefix sums of the drop costs
    const PA = [0];
    for (const a of as) { PA.push(PA[PA.length - 1] + delCost(a)); }
    const PB = [0];
    for (const b of bs) { PB.push(PB[PB.length - 1] + insCost(b)); }

    const D: number[][] = [];
    /** the previous match of each cell's last match ([0, 0] = the anchor) */
    const prev: number[][][] = [];
    /** each cell's link cost into its last match */
    const linkIn: number[][] = [];
    for (let i = 0; i <= n; i++) {
        D.push(new Array(m + 1).fill(Infinity));
        prev.push(new Array(m + 1).fill([0, 0]));
        linkIn.push(new Array(m + 1).fill(0));
    }

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const q: [A, B] = [as[i - 1], bs[j - 1]];
            const mc = matchCost(q[0], q[1]);
            if (mc === Infinity) { continue; }

            // the first match: everything before it dropped
            let lk = link(undefined, q);
            let best = PA[i - 1] + PB[j - 1] + lk;
            let bestPrev = [0, 0];
            let bestLink = lk;

            for (let i_ = 1; i_ < i; i_++) {
                for (let j_ = 1; j_ < j; j_++) {
                    const d = D[i_][j_];
                    if (d === Infinity) { continue; }
                    const drops = (PA[i - 1] - PA[i_]) + (PB[j - 1] - PB[j_]);
                    if (d + drops >= best) { continue; }
                    lk = link([as[i_ - 1], bs[j_ - 1]], q);
                    const c = d + drops + lk;
                    if (c < best) {
                        best = c;
                        bestPrev = [i_, j_];
                        bestLink = lk;
                    }
                }
            }

            D[i][j] = mc + best;
            prev[i][j] = bestPrev;
            linkIn[i][j] = bestLink;
        }
    }

    // close: the last match back to the anchor, the rest dropped
    let cost = PA[n] + PB[m] + link(undefined, undefined);
    let last = [0, 0];
    let closeLink = 0;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const d = D[i][j];
            if (d === Infinity) { continue; }
            const lk = link([as[i - 1], bs[j - 1]], undefined);
            const c = d + (PA[n] - PA[i]) + (PB[m] - PB[j]) + lk;
            if (c < cost) {
                cost = c;
                last = [i, j];
                closeLink = lk;
            }
        }
    }

    // traceback, from the end
    const ops: SeqOp<A, B>[] = [];
    let linkCost = closeLink;
    let [i, j] = [n, m];
    let [mi, mj] = last;
    for (;;) {
        while (i > mi) { ops.push({ type: 'delete', a: as[--i] }); }
        while (j > mj) { ops.push({ type: 'insert', b: bs[--j] }); }
        if (mi === 0) { break; }

        ops.push({ type: 'match', a: as[mi - 1], b: bs[mj - 1] });
        linkCost += linkIn[mi][mj];
        [mi, mj] = prev[mi][mj];
        i--;
        j--;
    }
    ops.reverse();

    return { cost, ops, D, linkCost };
}


export { alignLinked }
