import type { PathGeom } from './path-geom.js';
import { memoize } from 'flo-memoize';

const { PI: π } = Math;


/**
 * The same path traversed end → start: pieces reversed (order + flags),
 * geometry reversed, pooled forks mirrored (side/angle flip).
 */
const reverseGeom$ = memoize(function(pg: PathGeom): PathGeom {
    return {
        pieces: pg.pieces.toReversed()
            .map(p => ({ ...p, reversed: !p.reversed })),
        skelPss: pg.skelPss.map(ps => ps.toReversed()).reverse(),
        radii: pg.radii.toReversed(),
        L: pg.L,
        stubSal: pg.stubSal,
        stubN: pg.stubN,
        pooled: pg.pooled.map(c => ({
            edge: c.edge,
            dist: pg.L - c.dist,
            side: c.side === 1 ? -1 : 1,
            // Reversing the travel direction maps θ to θ − sign(θ)·π.
            angle: c.angle > 0 ? c.angle - π : c.angle + π
        }))
    };
});


export { reverseGeom$ }
