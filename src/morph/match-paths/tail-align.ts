/** One traceback step: a diagonal match (state 0) of samples (i, j), or a
 *  gap consuming a sample of A (state 1) or of B (state 2); `cost` is the
 *  step's match cost (0 for gap steps). */
interface AlignStep {
    readonly i: number;
    readonly j: number;
    readonly state: 0 | 1 | 2;
    readonly cost: number;
}


interface TailAlign {
    /** total alignment cost including tail penalties */
    readonly cost: number;
    /** summed tail penalties */
    readonly tailPen: number;
    /** unmatched u fractions at the leaf (start) ends */
    readonly tailStartA: number;
    readonly tailStartB: number;
    /** unmatched u fractions at the junction (end) ends - trunk only */
    readonly tailEndA: number;
    readonly tailEndB: number;
    /** full traceback, start → end */
    readonly steps: AlignStep[];
}


export type { TailAlign, AlignStep }