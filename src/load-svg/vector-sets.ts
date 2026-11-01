
/** the vector sets, one SVG font each (`vectorSetPath`), in menu order */
const vectorSets = ['zoo', 'achi', 'script', 'mi', 'other'] as const;

/** a vector set (see `vectorSets`) */
type VectorSet = typeof vectorSets[number];


/** Returns the path of the vector set's SVG font (relative to the root). */
function vectorSetPath(set: VectorSet): string {
    return `vectors/vectors-${set}.svg`;
}


export { vectorSets, vectorSetPath }
export type { VectorSet }
