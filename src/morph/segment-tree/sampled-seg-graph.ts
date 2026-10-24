import type { Circle } from 'flo-mat';


/**
 * The segment tree resampled into a DAG of directed feature samples for
 * product DTW: every segment yields two directed runs (v0→v1 and v1→v0) of
 * uniformly spaced (radius, turning) samples
 * 
 * * runs chain at shared vertices (no U-turns), so every walk through the DAG
 * is a leaf-to-leaf skeleton path sampled at (near) constant arc spacing.
 */
interface SampledSegGraph {
    /** normalized (÷ unit) radius per directed sample */
    readonly r: Float64Array;
    /** turning rate (dφ per normalized arc) per directed sample */
    readonly t: Float64Array;
    /** absolute travel direction per directed sample (reversed run = φ+π) */
    readonly φ: Float64Array;
    /** successor sample ids (within-run next, or continuations at a fork) */
    readonly succ: number[][];
    /** entry samples (runs leaving a leaf vertex) */
    readonly starts: number[];
    /** exit samples (runs arriving at a leaf vertex) */
    readonly ends: number[];
    /** leaf vertex of each start/end sample (keyed by sample id) */
    readonly leafOf: Map<number, Circle>;
    /** sample id in topological order */
    readonly topo: number[];
    /** normalized arc spacing (cost integration step) */
    readonly step: number;
    /** total skeleton material ≈ Σ 2r̂ dŝ (≈ salience fraction of the tree) */
    readonly material: number;
    /**
     * **diagnostics only** - per sample: the index (in the sampled segment
     * list) of the segment it lies on
     */
    readonly seg: Int32Array;
    /**
     * **diagnostics only** - per sample: its arc fraction along its segment,
     * from `vertS` (whichever way its run travels)
     */
    readonly pos: Float64Array;
}


export { SampledSegGraph }
