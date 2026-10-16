import type { RouteStep } from '../segment.js';


/** The same route walked the other way. */
function reverseRoute(route: RouteStep[]): RouteStep[] {
    return route
        .map(s => ({ seg: s.seg, reversed: !s.reversed }))
        .reverse();
}


export { reverseRoute }
