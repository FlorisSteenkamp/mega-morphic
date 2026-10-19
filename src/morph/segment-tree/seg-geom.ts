import type { Circle } from 'flo-mat';


/** What a segment's MAT walk yields (see `geomOf$`). */
interface SegGeom {
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

    readonly skelLen: number;
}


export type { SegGeom }
