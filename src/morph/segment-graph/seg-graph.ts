import type { FatBranch, FatBranchEdge } from "../fat-branch/fat-branch.js";
import type { SegVertex } from "./seg-vertex.js";
import type { Segment } from "./segment.js";


/**
 * The glyph skeleton cut at every fork: vertices = forks + leaf tips,
 * segments = the stretches between. Unlike the fat-branch tree, NO segment
 * crosses a fork, so any leaf-to-leaf path decomposes into whole segments.
 */
interface SegGraph {
    /** the fat-branch tree the graph was cut from */
    readonly root: FatBranch;
    readonly vertices: SegVertex[];
    readonly segments: Segment[];
    /** per fat branch: its attach vertex + tree edge (undefined for trunk) */
    readonly attachOf: Map<FatBranch, { v: number; edge?: FatBranchEdge }>;
    /** child branch → its parent (the root is absent) */
    readonly parentOf: Map<FatBranch, FatBranch>;
}


export { SegGraph }
