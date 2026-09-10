import type { Mutable } from "../../../mat/src/utils/mutable.js";


/**
 * Where a morph entry's junction end (the last point of its beziers) is
 * attached. In frame 1 (t=0) it sits at boundary `k1` of entry `e1`; in
 * frame 2 (t=1) at boundary `k2` of entry `e2`. At draw time the whole
 * entry is translated so its junction rides the parent's *drawn* skeleton
 * throughout the morph (the translation vanishes at t=0 and t=1).
 */
interface Glue {
    readonly e1: number;
    readonly k1: number;
    readonly e2: number;
    readonly k2: number;
}


/**
 * A boundary residual relative to the disk-envelope contact, in the
 * skeleton's local frame (see `boundary-residuals.ts`).
 */
interface SideRes {
    readonly sigma: 1 | -1;
    readonly rT: number;
    readonly rN: number;
}


/**
 * Corresponded boundary residual profiles of a morph entry, sampled at the
 * shared normalized skeleton positions `us` for both glyphs (A = glyph 1,
 * B = glyph 2) and both boundary sides (`out` walked tip → end, `back` the
 * other side).
 */
interface EntryResiduals {
    readonly us: number[];
    readonly outA: SideRes[];
    readonly backA: SideRes[];
    readonly outB: SideRes[];
    readonly backB: SideRes[];
}


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
    /** corresponded boundary residual profiles */
    readonly residuals?: EntryResiduals;
}


type MutableMorphEntry = Mutable<MorphEntry>;


export type { MorphEntry, MutableMorphEntry, Glue, EntryResiduals, SideRes }
