
/**
 * The segment graph resampled into a DAG of directed feature samples for
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
    /** leaf vertex id of each start/end sample (keyed by sample id) */
    readonly leafOf: Map<number, number>;
    /** sample id in topological order */
    readonly topo: number[];
    /** normalized arc spacing (cost integration step) */
    readonly step: number;
    /** total skeleton material ≈ Σ 2r̂ dŝ (≈ salience fraction of the tree) */
    readonly material: number;
}


export { SampledSegGraph }
