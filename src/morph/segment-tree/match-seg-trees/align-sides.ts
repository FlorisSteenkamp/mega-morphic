import type { SegChild } from './seg-child.js';
import { alignSeq } from '../../match-paths/align-seq.js';


/**
 * Aligns two routes' children per side (`1`, then `-1`) with
 * Needleman-Wunsch (`alignSeq`), each side's children in sequence order
 * (`getSeq`).
 *
 * * returns, per side, the two sequences and the alignment (`cost`, `ops`
 *   and the DP table `D`)
 *
 * @param chA the children of route A
 * @param chB the children of route B
 * @param matchCost the cost of matching child `a` with child `b`
 * @param dropCost the cost of dropping (deleting / inserting) a child
 */
function alignSides(
        chA: SegChild[],
        chB: SegChild[],
        matchCost: (a: SegChild, b: SegChild) => number,
        dropCost: (c: SegChild) => number) {

    return ([1, -1] as const).map(side => {
        const as = getSeq(chA, side);
        const bs = getSeq(chB, side);

        const alignedSeq = alignSeq(as, bs, matchCost, dropCost, dropCost);

        return { side, as, bs, ...alignedSeq };
    });
}


/**
 * Returns the children on the given side of the route, in sleeve-boundary
 * order.
 *
 * * first the regular children, ordered by `dist`
 *
 * * then the seam terminals of the fork this side leads into, in fork-sweep
 *   order (side `1` ends at the end fork, side `-1` at the start fork)
 */
function getSeq(
        ch: SegChild[],
        side: 1 | -1): SegChild[] {

    return [
        ...ch.filter(c => c.side === side && c.terminal === undefined)
            .sort((x, y) => side*(x.dist - y.dist)),
        ...ch.filter(c => c.terminal === (side === 1 ? 'end' : 'start'))
            .sort((x, y) => x.sweep! - y.sweep!)
    ];
}


export { alignSides }
