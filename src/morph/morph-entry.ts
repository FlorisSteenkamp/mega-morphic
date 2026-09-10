import type { Mutable } from '../utils/mutable.js';
import type { Glue } from './glue.js';


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
}


type MutableMorphEntry = Mutable<MorphEntry>;


export type { MorphEntry, MutableMorphEntry, Glue }
