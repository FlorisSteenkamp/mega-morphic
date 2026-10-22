import type { SegChild } from './seg-child.js';
import { alignCyclic } from '../../match-paths/align-cyclic.js';
import { alignSeq } from '../../match-paths/align-seq.js';
import { alignLinked } from '../../match-paths/align-linked.js';
import { MAX_CROSS } from './consts.js';

const { max, min } = Math;


/**
 * Returns the alignment of two routes' children around their outlines,
 * as one cyclic sequence each (`getCycle`), using cyclic Needleman-Wunsch
 * (`alignCyclic` of `alignSeq`).
 *
 * * flank and cap children share one sequence, so a child may match across
 *   a cap (a flank child near a route end with a terminal one there, or
 *   flank children on either side of a tip)
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

    const as = getCycle(chA);
    const bs = getCycle(chB);
    const aligned = alignCyclic(as, as.length,
        as => alignSeq(as, bs, matchCost, dropCost, dropCost));

    return { bs, ...aligned };
}


/**
 * Returns the alignment of two routes' children around their outlines, as
 * `alignOutline` does, but with consecutive matches also priced by how well
 * they link up (`alignCyclic` of `alignLinked`).
 *
 * * the links are anchored at the routes' start in both outlines, so a
 *   match may straddle that anchor either way round - rotations of both
 *   sequences are tried (rotating only `as` would let A's children cross it
 *   backwards but not B's, making the result depend on which glyph is A)
 *
 * * only rotations that carry children lying within `MAX_CROSS` of the
 *   outline past the anchor are tried: crossing the anchor is priced
 *   against the stroke width alone (`calcSpacingCost`), so a farther child
 *   is dropped sooner than matched across it
 *
 * * returns, besides the sequences (each in its winning rotation) and the
 *   alignment, the winning alignment's summed link costs (`linkCost`)
 *
 * @param chA the children of route A
 * @param chB the children of route B
 * @param outlineLenA the length of route A's outline
 * @param outlineLenB the length of route B's outline
 * @param matchCost the cost of matching child `a` with child `b`
 * @param dropCost the cost of dropping (deleting / inserting) a child
 * @param link the cost of the link from match `p` to match `q`
 * (`undefined` = the anchor)
 */
function alignOutlineLinked(
        chA: SegChild[],
        chB: SegChild[],
        outlineLenA: number,
        outlineLenB: number,
        matchCost: (a: SegChild, b: SegChild) => number,
        dropCost: (c: SegChild) => number,
        link: (
            p: [SegChild, SegChild] | undefined,
            q: [SegChild, SegChild] | undefined) => number) {

    const as = getCycle(chA);
    const bs = getCycle(chB);

    const rotA = alignCyclic(as, calcMaxRot(as, outlineLenA),
        as => alignLinked(as, bs, matchCost, dropCost, dropCost, link));

    // (`alignCyclic` names the rotated sequence `as` - here it is `bs`)
    const { as: bsRot, ...rotB } = alignCyclic(bs, calcMaxRot(bs, outlineLenB),
        bs => alignLinked(as, bs, matchCost, dropCost, dropCost, link));

    return rotB.cost < rotA.cost
        ? { ...rotB, as, bs: bsRot }
        : { ...rotA, bs };
}


/**
 * Returns the number of rotations of the cycle worth trying: one more than
 * the number of its leading children within `MAX_CROSS` of the outline
 * past the anchor (rotating by `k` carries the first `k` children across
 * it).
 *
 * @param cycle the children in outline order (`getCycle`)
 * @param outlineLen the length of the route's outline
 */
function calcMaxRot(
        cycle: SegChild[],
        outlineLen: number): number {

    let k = 0;
    while (k < cycle.length &&
           cycle[k].outlinePos <= MAX_CROSS*outlineLen) {

        k++;
    }

    return max(1, min(k + 1, cycle.length));
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


export { alignOutline, alignOutlineLinked, getCycle }
