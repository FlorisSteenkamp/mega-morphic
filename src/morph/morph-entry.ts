import type { Mutable } from '../utils/mutable.js';
import type { Glue } from './glue.js';
import type { SleeveSide } from './anchored-sleeves.js';


/**
 * A drawable of the morph: `a` (t=0) lerped to `b` (t=1), control point
 * for control point, optionally glued to a parent entry.
 */
interface MorphEntry {
    /** cubic Bézier control polygons at the start frame (t=0) */
    readonly a: number[][][];
    /** cubic Bézier control polygons at the end frame (t=1), aligned with `a` */
    readonly b: number[][][];
    readonly classes: string;
    /** optional attachment of this entry's junction end to parent entry boundaries */
    readonly glue?: Glue;
    /** maximal-disk radius per segment boundary of `a` (t=0) */
    readonly ra?: number[];
    /** maximal-disk radius per segment boundary of `b` (t=1) */
    readonly rb?: number[];
    /** normalized skeleton position per segment boundary */
    readonly us?: number[];
    /** disk-anchored boundary, out side (tip → end) */
    readonly sleeveOut?: SleeveSide;
    /** disk-anchored boundary, back side (end → tip) */
    readonly sleeveBack?: SleeveSide;
    /** winding sign of the outline (±1) - the tip cap arcs sweep this way */
    readonly capSign?: number;
    /** which frame is a collapsed point (topology entries) - its chord
     *  angles are meaningless fill */
    readonly collapsed?: 'a' | 'b';
}


type MutableMorphEntry = Mutable<MorphEntry>;


export type { MorphEntry, MutableMorphEntry, Glue }
