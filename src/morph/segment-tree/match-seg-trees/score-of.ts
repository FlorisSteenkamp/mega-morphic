import type { SegMatchedPair } from './seg-matched-pair.js';


/**
 * Returns the value every matching decision minimizes for a built pair: its
 * recursive `cost` plus its routes' measured `sway`.
 *
 * * the pair's own sway is kept out of its `cost`, but rides every choice:
 *   trunk selection, sub-route selection and the child alignment's match
 *   price - and so its parent's `cost` (its children's sway already is in
 *   its `cost`, through their scores)
 */
function scoreOf(
        mp: SegMatchedPair): number {

    return mp.cost + mp.sway;
}


export { scoreOf }
