import type { PathAlignDebug } from '../morph/match-paths/path-align-debug.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { RouteStep } from '../morph/segment-tree/segment.js';
import { sampleFeatures } from '../morph/match-paths/sample-features.js';
import { alignProfiles } from '../morph/match-paths/align-profiles.js';
import { composeRouteGeom } from '../morph/segment-tree/compose-segs.js';
import { lenOf$ } from '../morph/segment-tree/len-of.js';


/**
 * * **Debug only**
 *
 * Classic Gotoh re-run on chosen routes (viz-equivalent alignment).
 */
function alignOfRoutes(
        routeA: RouteStep[],
        routeB: RouteStep[],
        unit1: number,
        unit2: number,
        weights: PathCostWeights,
        trunkLevel: boolean): PathAlignDebug {

    const { skelPss: bzA, radii: rdA } = composeRouteGeom(routeA);
    const { skelPss: bzB, radii: rdB } = composeRouteGeom(routeB);
    const fA = sampleFeatures(bzA, rdA, unit1);
    const fB = sampleFeatures(bzB, rdB, unit2);
    const steps = alignProfiles(
        fA, fB,
        (lenOf$(bzA)/unit1) / (fA.u.length - 1),
        (lenOf$(bzB)/unit2) / (fB.u.length - 1),
        trunkLevel,
        weights);

    return {
        usA: fA.u, usB: fB.u,
        skelPssA: bzA, skelPssB: bzB,
        radiiA: rdA, radiiB: rdB,
        steps
    };
}


export { alignOfRoutes }
