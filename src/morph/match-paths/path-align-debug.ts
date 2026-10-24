/** Debug-only visualization data of a pair's profile alignment. */
interface PathAlignDebug {
    /** normalized sample positions along each path */
    readonly usA: number[];
    readonly usB: number[];
    readonly skelPssA: number[][][];
    readonly skelPssB: number[][][];
    readonly radiiA: number[];
    readonly radiiB: number[];
    /** full DTW traceback, start → end */
    readonly steps: AlignStep[];
    /** the DTW's table, as the DP ran it */
    readonly dp: DtwTable;
}


/**
 * Debug-only: a DTW's table in the order its DP ran - from the routes'
 * starts, or from their ends (`fromEnds`, a child pair: from its junctions).
 */
interface DtwTable {
    /**
     * per sample of A (rows) and of B (columns): the value of the best path
     * kept there (shape − del × covered, what the DP minimizes) - `Infinity`
     * where none reaches it
     */
    readonly values: number[][];
    /**
     * the chosen path through `values`, start → end: a diagonal into the
     * cell (`state` 0), A advancing alone (`1`) or B alone (`2`)
     */
    readonly path: { readonly i: number; readonly j: number; readonly state: 0 | 1 | 2 }[];
    /** the DP ran from the routes' ends */
    readonly fromEnds: boolean;
}


/** One traceback step: a diagonal match (state 0) of samples (i, j), or a
 *  gap consuming a sample of A (state 1) or of B (state 2); `cost` is the
 *  step's match cost (0 for gap steps). */
interface AlignStep {
    readonly i: number;
    readonly j: number;
    readonly state: 0 | 1 | 2;
    readonly cost: number;
}


export type { PathAlignDebug, DtwTable }
