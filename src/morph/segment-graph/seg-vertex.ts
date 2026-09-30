
/** A fork/leaf vertex of the segment graph. */
interface SegVertex {
    readonly id: number;
    /** vertex position (skeleton point) */
    readonly p: number[];
}


export { SegVertex }
