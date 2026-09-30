import type { FatBranch } from '../fat-branch/fat-branch.js';


/** A fork-to-fork/leaf skeleton stretch - no forks in its interior. */
interface Segment {
    /** graph vertex index at the segment's leaf-ward end (knot `fromEdge`) */
    readonly v0: number;
    /** graph vertex index at the segment's junction-ward end (knot `toEdge`) */
    readonly v1: number;
    /** skeleton beziers, v0 → v1 */
    readonly pss: number[][][];
    /** maximal-disk radius per bezier knot (`pss.length + 1` values) */
    readonly radii: number[];
    /** arc length of the segment's skeleton */
    readonly len: number;
    /** skeleton material 2·r̄·len in RAW area units (≈ region area; NOT
     *  normalized - divide by unit² for a salience fraction) */
    readonly material: number;
    /** boundary pieces alongside each skeleton edge (`pss.length` entries),
     *  per side, each in outline direction */
    readonly sleeves: readonly { out: number[][][]; back: number[][][] }[];
    /** provenance: the fat branch this segment was cut from */
    readonly branch: FatBranch;
    /** edge-index slice [fromEdge, toEdge) of the branch's skeleton */
    readonly fromEdge: number;
    readonly toEdge: number;
}


/** One step of a route: a whole graph segment, walked v0→v1 or reversed. */
interface RouteStep {
    readonly seg: Segment;
    readonly reversed: boolean;
}


export { Segment, RouteStep }
