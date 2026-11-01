import type { MorphEntry } from '../morph-entry.js';
import type { ResolvedMorph } from '../resolve-morph-at/resolve-morph-at.js';


/**
 * Returns the resolved morph's outline loops measured for the pose: every
 * loop not of a `lone` entry - or every loop, when all are (no component
 * has a partner) - but never a `hole`'s (the filled outline is measured).
 *
 * @param entries the morph entries
 * @param resolved the morph resolved at some `t`
 */
function mainOutlinesOf(
        entries: MorphEntry[],
        resolved: ResolvedMorph): number[][][][] {

    const { outlines, outlineEntry } = resolved;
    const solid = outlines.filter((_, k) => entries[outlineEntry[k]].hole !== true);
    const main = outlines.filter((_, k) =>
        entries[outlineEntry[k]].lone !== true &&
        entries[outlineEntry[k]].hole !== true);

    return main.length > 0 ? main : solid;
}


export { mainOutlinesOf }
