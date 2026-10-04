import type { SegVertex } from "./seg-vertex.js";
import type { Segment } from "./segment.js";


/**
 * The shape skeleton cut at every fork
 * 
 * * vertices = forks + leaf tips,
 * * segments = the stretches between.
 * 
 * * **no** segment crosses a fork, so any leaf-to-leaf path decomposes into
 *   whole segments
 */
interface SegGraph {
    /**
     * the shape's **original** outline loop cut at topological hole-closers
     */
    readonly loop: number[][][];
    readonly vertices: SegVertex[];
    readonly segments: Segment[];
}


export { SegGraph }
