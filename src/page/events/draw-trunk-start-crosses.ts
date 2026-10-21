import type { PageData } from '../page-data.js';
import type { MorphEntry } from '../../morph/morph-entry.js';
import { drawCross } from '../../draw/draw-cross.js';
import { clearOverlay } from './clear-overlay.js';


/** half-size of the trunk-start cross */
const CROSS_SIZE = 14;

/** classes of the trunk-start cross (`trunk-start` tags it for removal) */
const CROSS_CLASSES = 'purple thin50 nofill trunk-start';


/**
 * Marks the matched trunk's start with a thickish purple cross (×) on both
 * glyphs - the two points the matcher corresponds as the trunk routes'
 * starts (replacing the previous morph's crosses).
 *
 * * the trunk is the first morph entry (`buildMorphEntries` builds it first)
 *
 * @param refPageData the page data
 * @param entries the morph entries, UNALIGNED (each glyph's frame in its
 * own coordinates)
 */
function drawTrunkStartCrosses(
        refPageData: React.RefObject<PageData | null>,
        entries: MorphEntry[]): void {

    const gs = clearOverlay(refPageData.current!, 'trunk-start');
    if (gs === undefined || entries.length === 0) { return; }
    const [g1, g2] = gs;

    const { skelPssA, skelPssB } = entries[0];
    drawCross(g1, skelPssA[0][0], CROSS_SIZE, CROSS_CLASSES);
    drawCross(g2, skelPssB[0][0], CROSS_SIZE, CROSS_CLASSES);
}


export { drawTrunkStartCrosses, CROSS_SIZE, CROSS_CLASSES }
