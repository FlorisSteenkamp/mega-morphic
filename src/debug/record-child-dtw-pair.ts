declare var _debug_: Debug;
import type { Debug, ChildDtwPair } from './debug.js';


/** the window event telling the needle window the recorded pair changed */
const CHILD_DTW_PAIR_EVENT = 'child-dtw-pair';


/**
 * * **Debug only**
 *
 * Records the child pair last evaluated by the child-DTW tool, for the
 * needle window (`undefined`: none - the window shows the trunk pair), and
 * tells the window. A no-op unless morph debugging is enabled.
 *
 * @param pair the pair, or `undefined` to clear it
 */
function recordChildDtwPair(
        pair: ChildDtwPair | undefined): void {

    if (typeof _debug_ === 'undefined' ||
        _debug_.elems?.childDtwPair === undefined) {
        return;
    }

    _debug_.elems.childDtwPair.length = 0;
    if (pair !== undefined) { _debug_.elems.childDtwPair.push(pair); }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(CHILD_DTW_PAIR_EVENT));
    }
}


export { recordChildDtwPair, CHILD_DTW_PAIR_EVENT }
