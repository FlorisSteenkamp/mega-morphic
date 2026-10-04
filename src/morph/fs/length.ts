import { totalLength } from 'flo-bezier3';
import { memoize } from 'flo-memoize';


/**
 * Returns the total length of a bezier curve.
 */
const length$ = memoize(function(
        ps: number[][]) {

    return totalLength(ps);
});


export { length$ }
