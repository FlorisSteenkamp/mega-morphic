
/**
 * A fork-to-fork/leaf skeleton stretch - no forks in its interior.
 */
interface Segment {
    /** graph vertex index at the segment's start (first `pss` knot) */
    readonly vertIdS: number;
    /** graph vertex index at the segment's end (last `pss` knot) */
    readonly vertIdE: number;
    /** skeleton beziers, `vertIdS` → `vertIdE` */
    readonly skelPss: (number[][])[];
    /** maximal-disk radius per skeleton bezier knot (`pss.length + 1` values) */
    readonly radii: number[];
    /**
     * skeleton material 2·r̄·len in RAW area units (≈ region area; NOT
     * normalized - divide by unit² for a salience fraction)
     */
    readonly material: number;
    /**
     * boundary pieces alongside each skeleton edge (`pss.length` entries),
     * per side, each in outline direction
     */
    readonly sleeves: readonly {
        out: number[][][];
        back: number[][][]
    }[];
}


/**
 * One step of a route: a whole graph segment, walked v0→v1 or reversed.
 */
interface RouteStep {
    readonly seg: Segment;
    readonly reversed: boolean;
}


export { Segment, RouteStep }
