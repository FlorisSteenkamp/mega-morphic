declare var _debug_: Debug;
import type { Debug } from './debug.js';
import type { Circle } from 'flo-mat';
import type { Ranked } from '../morph/segment-tree/match-seg-trees/ranked.js';
import type { SegOp } from '../morph/segment-tree/match-seg-trees/seg-op.js';
import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import { scoreOf } from '../morph/segment-tree/match-seg-trees/score-of.js';


/**
 * * **Debug only**
 *
 * One leader of the trunk re-rank (recursion fields set only for
 * candidates that got a full evaluation).
 */
interface TrunkCandDebug {
    readonly startA: Circle;
    readonly startB: Circle;
    readonly endA: Circle;
    readonly endB: Circle;
    readonly dpTotal: number;
    /** cheap child-consistency estimate used in the ranking */
    readonly cheap: number;
    /** local sway measured along the candidate's intrinsic warp */
    readonly sway: number;
    /** stage-2 rank = shape + sway + cheap */
    readonly rank: number;
    /** the candidate that became the trunk */
    readonly chosen: boolean;
    /** full recursive cost (buildPair) */
    readonly recCost?: number;
    /** selection value = recCost + sway (`scoreOf`) */
    readonly sel?: number;
    readonly ops?: SegOp[];
}


/** the leaders fully evaluated so far in the current match */
const evaluated = new Map<Ranked, { recCost: number; sel: number; ops: SegOp[] }>();


function isRecording(): boolean {
    return typeof _debug_ !== 'undefined' &&
        _debug_.elems?.trunkCands !== undefined;
}


/**
 * * **Debug only**
 *
 * Notes one trunk leader's full recursive evaluation (for the table stored
 * by `recordTrunkCands`). A no-op unless morph debugging is enabled.
 *
 * @param l the leader
 * @param pair its recursively built pair
 */
function recordTrunkEval(
        l: Ranked,
        pair: SegMatchedPair): void {

    if (!isRecording()) { return; }

    // selection value, as in `pickBest`
    const sel = scoreOf(pair);

    evaluated.set(l, { recCost: pair.cost, sel, ops: pair.ops });
}


/**
 * * **Debug only**
 *
 * Stores the trunk re-rank table of the latest match, with the evaluations
 * noted by `recordTrunkEval`. The chosen candidate is the first evaluated
 * leader of minimum `sel` (as selected by `pickBest`). A no-op unless
 * morph debugging is enabled.
 *
 * @param leaders the trunk leaders in rank order
 */
function recordTrunkCands(leaders: Ranked[]): void {
    if (!isRecording()) { return; }

    let chosen: Ranked | undefined;
    let chosenSel = Infinity;
    for (const l of leaders) {
        const sel = evaluated.get(l)?.sel;
        if (sel !== undefined && sel < chosenSel) {
            chosenSel = sel;
            chosen = l;
        }
    }

    const cands = leaders.map(l => ({
        startA: l.c.startA, startB: l.c.startB,
        endA: l.c.endA, endB: l.c.endB,
        dpTotal: l.c.totalCost, cheap: l.cheap,
        sway: l.c.swayCost, rank: l.rank,
        chosen: l === chosen,
        ...(evaluated.get(l) ?? {})
    }));

    evaluated.clear();

    // Keep only the LATEST table.
    _debug_.elems.trunkCands.length = 0;
    _debug_.elems.trunkCands.push(...cands);
}


export { recordTrunkEval, recordTrunkCands }
export type { TrunkCandDebug }
