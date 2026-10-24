import type { Segment, RouteStep } from './segment.js';
import { geomOf$ } from './geom-of.js';


type SleevePair = { out: number[][][]; back: number[][][] };

interface ComposedGeom {
    readonly skelPss: number[][][];
    readonly radii: number[];
    readonly sleeves: readonly SleevePair[];
}


/**
 * A segment's geometry, optionally walked in reverse (skeleton reversed;
 * edge sleeves reverse order and swap sides - the boundary geometry itself
 * keeps its outline direction).
 *
 * * not reversed: the memoized `geomOf$` arrays themselves - don't mutate
 *   the result
 */
function composeSeg(
        seg: Segment,
        reversed: boolean): ComposedGeom {

    const { skelPss, radii, sleeves } = geomOf$(seg);

    if (!reversed) {
        return { skelPss, radii, sleeves };
    }

    return {
        skelPss: skelPss.toReversed().map(ps => ps.toReversed()),
        radii: radii.toReversed(),
        sleeves: sleeves.toReversed().map(s => ({ out: s.back, back: s.out }))
    };
}


/** A route's composite geometry (travel order, per-step direction). */
function composeRouteGeom(route: readonly RouteStep[]): ComposedGeom {
    const gs = route.map(({ seg, reversed }) => composeSeg(seg, reversed));

    return {
        skelPss: gs.flatMap(g => g.skelPss),
        // consecutive steps share their joint vertex's radius
        radii: gs.flatMap((g, i) => i === 0 ? g.radii : g.radii.slice(1)),
        sleeves: gs.flatMap(g => g.sleeves)
    };
}


export { composeSeg, composeRouteGeom }
