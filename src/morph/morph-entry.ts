import type { Mutable } from '../utils/mutable.js';
import type { Glue } from './glue.js';
import type { SleeveSide } from './anchored-sleeves.js';


/**
 * A drawable of the morph: `a` (t=0) lerped to `b` (t=1), control point
 * for control point, optionally glued to a parent entry.
 */
interface MorphEntry {
    readonly a: number[][][];
    readonly b: number[][][];
    readonly classes: string;
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
}


type MutableMorphEntry = Mutable<MorphEntry>;


export type { MorphEntry, MutableMorphEntry, Glue }
