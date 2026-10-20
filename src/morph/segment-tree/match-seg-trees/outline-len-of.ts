import type { Circle } from 'flo-mat';
import type { RouteStep } from '../segment.js';
import { geomOf$ } from '../geom-of.js';
import { lenOfRoute$ } from '../len-of.js';

const { PI: π } = Math;


/** a route's idealized sleeve outline, as children's positions refer to it */
interface OutlineFrame {
    /** the outline's length (`outlineLenOf`) */
    readonly len: number;
    /** the end anchor's position as an outline fraction (`endAnchorOf`) */
    readonly end: number;
}


/**
 * Returns the route's idealized sleeve outline frame (its length and end
 * anchor).
 */
function outlineFrameOf(
        route: RouteStep[]): OutlineFrame {

    const len = outlineLenOf(route);

    return { len, end: endAnchorOf(route)/len };
}


/**
 * Returns the length of the route's idealized sleeve outline: both flanks
 * (each as long as the route) plus a half circle around each end disk.
 *
 * * it is the period of the children's `outlinePos`
 */
function outlineLenOf(
        route: RouteStep[]): number {

    const [vStart, vEnd] = routeEndsOf(route);

    return 2*lenOfRoute$(route) + π*(vStart.radius + vEnd.radius);
}


/**
 * Returns the outline position (as `outlinePos`) of the route's end anchor:
 * the middle of its end cap, where the outline turns from the out flank to
 * the back flank.
 */
function endAnchorOf(
        route: RouteStep[]): number {

    const [, vEnd] = routeEndsOf(route);

    return lenOfRoute$(route) + π*vEnd.radius/2;
}


/**
 * Returns the route's start and end vertices.
 */
function routeEndsOf(
        route: RouteStep[]): [Circle, Circle] {

    const first = route[0];
    const last = route[route.length - 1];
    const { vertS: s0, vertE: e0 } = geomOf$(first.seg);
    const { vertS: s1, vertE: e1 } = geomOf$(last.seg);

    return [first.reversed ? e0 : s0, last.reversed ? s1 : e1];
}


export { outlineLenOf, endAnchorOf, outlineFrameOf }
export type { OutlineFrame }
