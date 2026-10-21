import type { Glue } from './glue.js';
import type { SleeveSide } from './anchored-sleeves.js';


/**
 * A drawable of the morph
 * 
 * * `a` (t=0) lerped to `b` (t=1), control point
 * for control point, optionally glued to a parent entry.
 */
interface MorphEntry {
    /**
     * skeleton Bézier control polygons at the start frame (t=0) -
     * quadratics for matched entries; lines/quadratics for topology entries
     * (their collapsed frame mirrors the real one)
     */
    readonly skelPssA: number[][][];
    /** skeleton Bézier control polygons at the end frame (t=1), aligned with `a` */
    readonly skelPssB: number[][][];
    readonly classes: string;
    /** optional attachment of this entry's junction end to parent entry boundaries */
    readonly glue?: Glue;
    /** maximal-disk radius per segment boundary of `a` (t=0) */
    readonly ra: number[];
    /** maximal-disk radius per segment boundary of `b` (t=1) */
    readonly rb: number[];
    /** disk-anchored boundary, out side (tip → end) */
    readonly sleeveOut: SleeveSide;
    /** disk-anchored boundary, back side (end → tip) */
    readonly sleeveBack: SleeveSide;
    /** winding sign of the outline (±1) - the tip cap arcs sweep this way */
    readonly capSign: number;
    /**
     * which frame is a collapsed point (topology entries) - its chord
     * angles are meaningless fill
     */
    readonly collapsed?: 'a' | 'b';
    /**
     * part of a component without a partner (it shrinks to / grows from a
     * point) - left out of the pose measurement (it takes no part in the
     * matched components' blend)
     */
    readonly lone?: true;
    /**
     * a free `lone` entry's tie to the matched shape: it is carried along by
     * the drawn motion of a point on a matched entry's skeleton
     */
    readonly tether?: Tether;
}


/**
 * Where a component without a partner is tied to the matched shape: the
 * point at fractional segment-boundary index `k` of entry `e`'s skeleton
 * (index for index the same point in both frames). Its whole component is
 * translated by how far that point has moved, at the drawn `t`, from where
 * it is in the component's own frame (`side`).
 */
interface Tether {
    readonly e: number;
    readonly k: number;
    readonly side: 'a' | 'b';
}


export type { MorphEntry, Glue, Tether }
