import type { Segment, RouteStep } from './segment.js';
import { memoize } from 'flo-memoize';
import { sum } from '../../utils/sum.js';
import { length$ } from '../fs/length.js';
import { geomOf$ } from './geom-of.js';


const lenOf$ = memoize(function(pss: number[][][]) {
    return sum(pss.map(length$));
});

/** total skeleton length of the segments */
const lenOfSegs$ = memoize(function(segs: readonly Segment[]) {
    return sum(segs.map(s => lenOf$(geomOf$(s).skelPss)));
});

/** total skeleton length of the route */
const lenOfRoute$ = memoize(function(route: readonly RouteStep[]) {
    return sum(route.map(st => lenOf$(geomOf$(st.seg).skelPss)));
});


export { lenOf$, lenOfSegs$, lenOfRoute$ }
