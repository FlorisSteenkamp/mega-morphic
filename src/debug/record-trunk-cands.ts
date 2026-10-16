declare var _debug_: Debug;
import type { Debug } from './debug.js';
import type { Circle } from 'flo-mat';
import type { Ranked } from '../morph/segment-tree/match-seg-trees/ranked.js';
import type { SegOp } from '../morph/segment-tree/match-seg-trees/seg-op.js';


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
    /** stage-2 rank = dp + sway + cheap */
    readonly rank: number;
    /** the candidate that became the trunk */
    readonly chosen: boolean;
    /** full recursive cost (buildPair) */
    readonly recCost?: number;
    /** selection value = recCost + sway */
    readonly sel?: number;
    readonly ops?: SegOp[];
}


/**
 * * **Debug only**
 *
 * Stores the trunk re-rank table of the latest match. A no-op unless
 * morph debugging is enabled.
 */
function recordTrunkCands(
        leaders: Ranked[],
        evaluated: Map<Ranked, { recCost: number; sel: number; ops: SegOp[] }>,
        chosen: Ranked | undefined) {

    if (typeof _debug_ === 'undefined' ||
        _debug_.elems?.trunkCands === undefined) {
        return;
    }

    const cands = leaders.map(l => ({
        startA: l.c.startA, startB: l.c.startB,
        endA: l.c.endA, endB: l.c.endB,
        dpTotal: l.c.totalCost, cheap: l.cheap,
        sway: l.c.swayCost, rank: l.rank,
        chosen: l === chosen,
        ...(evaluated.get(l) ?? {})
    }));

    // Keep only the LATEST table.
    _debug_.elems.trunkCands.length = 0;
    _debug_.elems.trunkCands.push(...cands);
}


export { recordTrunkCands }
export type { TrunkCandDebug }
