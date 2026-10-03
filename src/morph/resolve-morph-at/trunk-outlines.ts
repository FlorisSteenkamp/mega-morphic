import type { MorphEntry } from '../morph-entry.js';


/**
 * The outline loops belonging to TRUNK entries (no glue - the free-floating
 * route(s); side branches and ins/del topo entries are all glued).
 */
function trunkOutlines(
        entries: MorphEntry[],
        outlines: number[][][][],
        outlineEntry: number[]): number[][][][] {

    return outlines.filter(
        (_, k) => entries[outlineEntry[k]].glue === undefined);
}


export { trunkOutlines }
