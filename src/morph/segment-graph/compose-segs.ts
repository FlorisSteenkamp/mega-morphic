import type { Segment, RouteStep } from './segment.js';


type SleevePair = { out: number[][][]; back: number[][][] };

interface ComposedGeom {
    bz: number[][][];
    rd: number[];
    edges: SleevePair[];
}


/**
 * Contiguous same-branch segments' composite geometry from the segments'
 * own data, optionally walked in reverse (skeleton reversed; edge sleeves
 * reverse order and swap sides - the boundary geometry itself keeps its
 * outline direction).
 */
function composeSegs(
        segs: readonly Segment[],
        reversed = false): ComposedGeom {

    let bz: number[][][] = [];
    let rd: number[] = [];
    let edges: SleevePair[] = [];

    for (const seg of segs) {
        bz = [...bz, ...seg.pss];
        rd = rd.length === 0 ? [...seg.radii] : [...rd, ...seg.radii.slice(1)];
        edges = [...edges, ...seg.sleeves];
    }

    if (reversed) {
        bz = bz.map(ps => ps.toReversed()).reverse();
        rd = rd.toReversed();
        edges = edges.toReversed()
            .map(e => ({ out: e.back, back: e.out }));
    }

    return { bz, rd, edges };
}


/** A route's composite geometry (travel order, per-step direction). */
function composeRouteGeom(route: readonly RouteStep[]): ComposedGeom {

    let bz: number[][][] = [];
    let rd: number[] = [];
    let edges: SleevePair[] = [];

    for (const { seg, reversed } of route) {
        const g = composeSegs([seg], reversed);
        bz = [...bz, ...g.bz];
        rd = rd.length === 0 ? g.rd : [...rd, ...g.rd.slice(1)];
        edges = [...edges, ...g.edges];
    }

    return { bz, rd, edges };
}


export { composeSegs, composeRouteGeom }
export type { ComposedGeom }
