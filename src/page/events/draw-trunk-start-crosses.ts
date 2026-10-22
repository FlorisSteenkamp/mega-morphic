import type { PageData } from '../page-data.js';
import type { MorphEntry } from '../../morph/morph-entry.js';
import { drawCross } from '../../draw/draw-cross.js';
import { clearOverlay } from './clear-overlay.js';


/** half-size of the trunk-start cross */
const CROSS_SIZE = 7;

/** classes of the trunk-start cross (`trunk-start` tags it for removal) */
const CROSS_CLASSES = 'purple thin10 nofill trunk-start';


/**
 * Marks each matched trunk's start with a small thin purple cross (×) on both
 * glyphs - the two points the matcher corresponds as the trunk routes'
 * starts (replacing the previous morph's crosses).
 *
 * * a trunk is an entry glued to nothing - one per matched component pair
 *   (a component without a partner, marked `collapsed`, has none)
 *
 * @param refPageData the page data
 * @param entries the morph entries, UNALIGNED (each glyph's frame in its
 * own coordinates)
 */
function drawTrunkStartCrosses(
        refPageData: React.RefObject<PageData | null>,
        entries: MorphEntry[]): void {

    const gs = clearOverlay(refPageData.current!, 'trunk-start');
    if (gs === undefined) { return; }
    const [g1, g2] = gs;

    for (const { skelPssA, skelPssB, glue, collapsed } of entries) {
        if (glue !== undefined || collapsed !== undefined) { continue; }

        drawCross(g1, skelPssA[0][0], CROSS_SIZE, CROSS_CLASSES);
        drawCross(g2, skelPssB[0][0], CROSS_SIZE, CROSS_CLASSES);
    }
}


export { drawTrunkStartCrosses, CROSS_SIZE, CROSS_CLASSES }
