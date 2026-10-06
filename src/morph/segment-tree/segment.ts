import type { Circle } from 'flo-mat';


/**
 * A fork-to-fork/leaf skeleton stretch - no forks in its interior.
 *
 * A shape's segment tree is simply its `Segment[]` - the skeleton cut at
 * every fork:
 *
 * * vertices = forks + leaf tips = the MAT's maximal-disk circles there,
 *   implicit as the segments' end vertices (`vertS`/`vertE`) and compared
 *   by identity (flo-mat shares one `Circle` object per MAT vertex),
 * * segments = the stretches between.
 *
 * * **no** segment crosses a fork, so any leaf-to-leaf path decomposes into
 *   whole segments
 */
interface Segment {
    /** the vertex (maximal-disk circle) at the segment's start (first `skelPss` knot) */
    readonly vertS: Circle;
    /** the vertex (maximal-disk circle) at the segment's end (last `skelPss` knot) */
    readonly vertE: Circle;
    /** skeleton beziers, `vertS` → `vertE` */
    readonly skelPss: (number[][])[];
    /** maximal-disk radius per skeleton bezier knot (`skelPss.length + 1` values) */
    readonly radii: number[];
    /**
     * the area of the segment's region (between its sleeves, the fork disks
     * split between the segments meeting there - see `segmentArea`) in RAW
     * area units (NOT normalized - divide by unit² for a salience fraction)
     */
    readonly material: number;
    /**
     * boundary pieces alongside each skeleton edge (`skelPss.length` entries),
     * per side, each in outline direction
     */
    readonly sleeves: readonly {
        out: number[][][];
        back: number[][][]
    }[];
}


/**
 * One step of a route: a whole tree segment, walked v0→v1 or reversed.
 */
interface RouteStep {
    readonly seg: Segment;
    readonly reversed: boolean;
}


export { Segment, RouteStep }
