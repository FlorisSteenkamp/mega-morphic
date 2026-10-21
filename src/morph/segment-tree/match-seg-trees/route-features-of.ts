import type { SegChild } from './seg-child.js';


/** The features along a route: where it forks, and its ends. */
interface RouteFeatures {
    /** the route's length */
    readonly len: number;
    /**
     * the features' distances along the route, ascending: every fork a
     * child (matched or not) hangs off, plus both ends
     */
    readonly dists: number[];
}


/**
 * Returns the features along a route (`RouteFeatures`): the distinct forks
 * its children hang off, plus its ends.
 *
 * @param children the children hanging off the route
 * @param len the route's length
 */
function routeFeaturesOf(
        children: SegChild[],
        len: number): RouteFeatures {

    const dists = [...new Set([0, ...children.map(c => c.dist), len])]
        .sort((x, y) => x - y);

    return { len, dists };
}


export { routeFeaturesOf }
export type { RouteFeatures }
