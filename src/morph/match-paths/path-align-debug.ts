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


export type { PathAlignDebug, AlignStep }
