import type { PageData } from '../page-data.js';
import { drawMatch } from './draw-match.js';
import { showVertexNums } from './show-vertex-nums.js';


/**
 * Shows/hides one of the last morph's match overlays on svgs 1 and 2.
 *
 * @param refPageData
 * @param key which overlay: the match itself or the fat trees' vertex numbers
 * @param show
 */
function drawOverlay(
        refPageData: React.RefObject<PageData | null>,
        key: 'match' | 'vertexNums',
        show: boolean): void {

    if (key === 'match') { drawMatch(refPageData, show); }
    else { showVertexNums(refPageData, show); }
}


export { drawOverlay }
