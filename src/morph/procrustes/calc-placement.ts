import type { Pose } from './pose.js';
import { getShapeArea } from 'flo-boolean';

const { sqrt, abs } = Math;


/** Where a shape is and how big: the part of its `Pose` without the axis. */
type Placement = Pick<Pose, 'centroid' | 'scale'>;


/**
 * 5-point Gauss-Legendre quadrature on [0,1]: exact for polynomials up to
 * degree 9 - the centroid integrands of a cubic bezier (`x²·y'`) are of
 * degree 8.
 */
const GL_TS = [
    0.04691007703066800, 0.23076534494715845, 0.5,
    0.76923465505284155, 0.95308992296933200
];
const GL_WS = [
    0.11846344252809454, 0.23931433524968324, 0.28444444444444444,
    0.23931433524968324, 0.11846344252809454
];


/**
 * Returns the placement of a shape - its area centroid and scale (√area) -
 * exactly as `calcProcrustes$` measures them.
 *
 * * all the live pose correction needs (`poseCorrectionAt`): measuring the
 *   whole pose (second moments too) every drawn frame cost most of a
 *   frame's time
 *
 * @param bezierLoop the shape's loops (all of them, flattened)
 */
function calcPlacement(
        bezierLoop: (number[][])[]): Placement {

    // signed (negative for clockwise loops)
    const A = getShapeArea(bezierLoop);

    return {
        centroid: calcCentroid(bezierLoop, A),
        scale: sqrt(abs(A))
    };
}


/**
 * Returns the area centroid of a shape (Green's theorem, as flo-boolean's
 * `getShapeCentroid`: `(∮x²dy, -∮y²dx)/2A`), each bezier's integrals by
 * Gauss-Legendre quadrature - exact for lines, quadratics and cubics, and
 * many times faster than integrating their polynomials.
 *
 * @param shape the shape's beziers (lines, quadratics or cubics)
 * @param A its signed area
 */
function calcCentroid(
        shape: (number[][])[],
        A: number): number[] {

    let cx = 0;
    let cy = 0;
    for (const ps of shape) {
        for (let k = 0; k < GL_TS.length; k++) {
            const [x, y, dx, dy] = evalWithDerivative(ps, GL_TS[k]);
            const w = GL_WS[k];
            cx += w*x*x*dy;
            cy += w*y*y*dx;
        }
    }

    return [cx/(2*A), -cy/(2*A)];
}


/**
 * Returns the bezier's point and first derivative at `t`: `[x, y, x', y']`
 * (lines, quadratics and cubics).
 */
function evalWithDerivative(
        ps: number[][],
        t: number): [number, number, number, number] {

    const s = 1 - t;
    const [[x0, y0], [x1, y1]] = ps;

    if (ps.length === 2) {
        return [s*x0 + t*x1, s*y0 + t*y1, x1 - x0, y1 - y0];
    }

    const [x2, y2] = ps[2];
    if (ps.length === 3) {
        return [
            s*s*x0 + 2*s*t*x1 + t*t*x2,
            s*s*y0 + 2*s*t*y1 + t*t*y2,
            2*(s*(x1 - x0) + t*(x2 - x1)),
            2*(s*(y1 - y0) + t*(y2 - y1))
        ];
    }

    const [x3, y3] = ps[3];

    return [
        s*s*s*x0 + 3*s*s*t*x1 + 3*s*t*t*x2 + t*t*t*x3,
        s*s*s*y0 + 3*s*s*t*y1 + 3*s*t*t*y2 + t*t*t*y3,
        3*(s*s*(x1 - x0) + 2*s*t*(x2 - x1) + t*t*(x3 - x2)),
        3*(s*s*(y1 - y0) + 2*s*t*(y2 - y1) + t*t*(y3 - y2))
    ];
}


export { calcPlacement }
export type { Placement }
