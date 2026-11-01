import type { PageData } from '../page-data.js';
import { drawMatch } from './draw-match.js';
import { drawMatchHoles } from './draw-match-holes.js';
import { showVertexNums } from './show-vertex-nums.js';


/** the overlays on svgs 1 and 2 (not drawn per MAT) */
type OverlayKey = 'match' | 'matchHoles' | 'vertexNums';


/** Returns true if the debug element is an overlay (`drawOverlay`). */
function isOverlayKey(key: string): key is OverlayKey {
    return key === 'match' || key === 'matchHoles' || key === 'vertexNums';
}


/**
 * Shows/hides one of the overlays on svgs 1 and 2.
 *
 * @param refPageData
 * @param key which overlay: the last morph's match, the hole match or the
 * fat trees' vertex numbers
 * @param show
 */
function drawOverlay(
        refPageData: React.RefObject<PageData | null>,
        key: OverlayKey,
        show: boolean): void {

    if (key === 'match') { drawMatch(refPageData, show); }
    else if (key === 'matchHoles') { drawMatchHoles(refPageData, show); }
    else { showVertexNums(refPageData, show); }
}


export { drawOverlay, isOverlayKey }
