import type { SegVertex } from "./seg-vertex.js";
import type { Segment } from "./segment.js";


/**
 * The glyph skeleton cut at every fork: vertices = forks + leaf tips,
 * segments = the stretches between. NO segment crosses a fork, so any
 * leaf-to-leaf path decomposes into whole segments.
 */
interface SegGraph {
    /** the glyph's outline loop */
    readonly loop: number[][][];
    /** intrinsic length scale √|loop area| (unit² = the area normalizer) */
    readonly unit: number;
    readonly vertices: SegVertex[];
    readonly segments: Segment[];
}


export { SegGraph }
