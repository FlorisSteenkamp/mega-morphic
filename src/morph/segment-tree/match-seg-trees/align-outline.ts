import type { SegChild } from './seg-child.js';
import { alignCyclic } from '../../match-paths/align-cyclic.js';


/**
 * Returns the alignment of two routes' children around their outlines,
 * as one cyclic sequence each (`getCycle`), using cyclic Needleman-Wunsch
 * (`alignCyclic`).
 *
 * * flank and cap children share one sequence, so a child may match across
 *   a cap (a flank child near a route end with a terminal one there, or
 *   flank children on either side of a tip) - the position cost
 *   (`outlinePos`) prices how far it travels
 *
 * * returns the two sequences (`as` in the winning rotation) and the
 *   alignment (`cost`, `ops` and the DP table `D`)
 *
 * @param chA the children of route A
 * @param chB the children of route B
 * @param matchCost the cost of matching child `a` with child `b`
 * @param dropCost the cost of dropping (deleting / inserting) a child
 */
function alignOutline(
        chA: SegChild[],
        chB: SegChild[],
        matchCost: (a: SegChild, b: SegChild) => number,
        dropCost: (c: SegChild) => number) {

    const bs = getCycle(chB);
    const aligned = alignCyclic(getCycle(chA), bs, matchCost, dropCost, dropCost);

    return { bs, ...aligned };
}


/**
 * Returns the children of a route in the order its sleeve outline passes
 * them (the order of `outlinePos`).
 *
 * * the out flank's regular children (side `1`), by ascending `dist`
 *
 * * the end fork's terminals, by `sweep`
 *
 * * the back flank's regular children (side `-1`), by descending `dist`
 *
 * * the start fork's terminals, by `sweep`
 */
function getCycle(
        ch: SegChild[]): SegChild[] {

    const ofFlank = (side: 1 | -1) => ch
        .filter(c => c.side === side && c.terminal === undefined)
        .sort((x, y) => side*(x.dist - y.dist));

    const ofCap = (terminal: 'start' | 'end') => ch
        .filter(c => c.terminal === terminal)
        .sort((x, y) => x.sweep! - y.sweep!);

    return [...ofFlank(1), ...ofCap('end'), ...ofFlank(-1), ...ofCap('start')];
}


export { alignOutline }
