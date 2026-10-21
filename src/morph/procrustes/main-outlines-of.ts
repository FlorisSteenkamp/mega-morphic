import type { MorphEntry } from '../morph-entry.js';
import type { ResolvedMorph } from '../resolve-morph-at/resolve-morph-at.js';


/**
 * Returns the resolved morph's outline loops measured for the pose: every
 * loop not of a `lone` entry - or every loop, when all are (no component
 * has a partner).
 *
 * @param entries the morph entries
 * @param resolved the morph resolved at some `t`
 */
function mainOutlinesOf(
        entries: MorphEntry[],
        resolved: ResolvedMorph): number[][][][] {

    const { outlines, outlineEntry } = resolved;
    const main = outlines.filter((_, k) => entries[outlineEntry[k]].lone !== true);

    return main.length > 0 ? main : outlines;
}


export { mainOutlinesOf }
