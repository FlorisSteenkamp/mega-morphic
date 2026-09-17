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
}


export type { TailAlign }