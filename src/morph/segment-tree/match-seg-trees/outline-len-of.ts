import type { RouteStep } from '../segment.js';
import { geomOf$ } from '../geom-of.js';
import { lenOfRoute$ } from '../len-of.js';

const { PI: π } = Math;


/**
 * Returns the length of the route's idealized sleeve outline: both flanks
 * (each as long as the route) plus a half circle around each end disk.
 *
 * * it is the period of the children's `outlinePos`
 */
function outlineLenOf(
        route: RouteStep[]): number {

    const first = route[0];
    const last = route[route.length - 1];
    const { vertS: s0, vertE: e0 } = geomOf$(first.seg);
    const { vertS: s1, vertE: e1 } = geomOf$(last.seg);
    const vStart = first.reversed ? e0 : s0;
    const vEnd = last.reversed ? s1 : e1;

    return 2*lenOfRoute$(route) + π*(vStart.radius + vEnd.radius);
}


export { outlineLenOf }
