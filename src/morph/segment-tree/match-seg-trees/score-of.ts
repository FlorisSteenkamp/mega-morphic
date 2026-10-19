import type { SegMatchedPair } from './seg-matched-pair.js';


/**
 * Returns the value every matching decision minimizes for a built pair: its
 * recursive `cost` plus its routes' measured `sway`.
 *
 * * sway is kept out of the reported `cost` (children and shape stay
 *   intrinsic), but it rides every choice: trunk selection, sub-route
 *   selection and the child alignment's match price
 */
function scoreOf(
        mp: SegMatchedPair): number {

    return mp.cost + mp.sway;
}


export { scoreOf }
