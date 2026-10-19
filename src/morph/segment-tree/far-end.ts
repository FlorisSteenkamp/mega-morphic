import type { Circle } from 'flo-mat';
import type { Segment } from './segment.js';
import { geomOf$ } from './geom-of.js';


/** The segment's end vertex other than `v`. */
function farEnd(s: Segment, v: Circle): Circle {
    const { vertS, vertE } = geomOf$(s);
    return vertS === v ? vertE : vertS;
}


export { farEnd }
