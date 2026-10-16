import type { Segment, SegGeom } from './segment.js';
import type { CpNode } from 'flo-mat';
import { getMatCurveToNext, getBoundaryBeziersToNext } from 'flo-mat';
import { lineToQuadratic } from 'flo-bezier3';
import { memoize } from 'flo-memoize';
import { stepsOf$ } from './steps-of.js';
import { segmentArea } from './segment-area.js';
import { lenOf$ } from './len-of.js';


/**
 * Everything a segment's MAT walk yields (see `Segment`), computed once.
 *
 * * each step `cp` → `cp.next` runs alongside one skeleton edge, from `cp`'s
 *   maximal disk to `cp.next`'s. The outline runs along BOTH sides of the
 *   skeleton, and the MAT links the two sides directly: the opposite-side
 *   step of `cp` is `cp.next.prevOnCircle` (its twin). The step gives the
 *   edge's `out` sleeve, the twin its `back` sleeve.
 */
const geomOf$ = memoize(function(
        seg: Segment): SegGeom {

    const steps = stepsOf$(seg);

    const skelPss: number[][][] = [];
    const radii = [seg.pointOnShape.circle.radius];
    const sleeves: { out: number[][][]; back: number[][][] }[] = [];

    for (const step of steps) {
        radii.push(step.next.pointOnShape.circle.radius);
        skelPss.push(skelCurveOf(step));
        sleeves.push({
            out: getBoundaryBeziersToNext(step),
            back: getBoundaryBeziersToNext(step.next.prevOnCircle)
        });
    }

    const vertS = seg.pointOnShape.circle;
    const vertE = steps[steps.length - 1].next.pointOnShape.circle;
    const material = segmentArea(vertS, vertE, sleeves);

    const skelLen = lenOf$(skelPss);

    return { vertS, vertE, skelPss, radii, material, sleeves, skelLen };
});


/**
 * The single skeleton bezier of the step `cp` → `cp.next`.
 *
 * * flo-mat returns 2 quads (joined at an inflection) for twisted edges
 *   (~1% of steps); those are replaced by the chord as a degree-elevated
 *   line so each step stays one bezier (keeps `radii` / `sleeves` aligned).
 * * measured on the test font the line is off the true medial axis by at
 *   most ~0.08% of glyph size (comparable to the 2 quads, better than them
 *   where the end tangents are unreliable); the cost is a tangent kink at
 *   its ends (median ~0.5°)
 */
function skelCurveOf(cp: CpNode): number[][] {
    const pss = getMatCurveToNext(cp);
    if (pss.length === 1) { return pss[0]; }

    const p0 = pss[0][0];
    const p1 = pss[pss.length - 1].at(-1)!;

    return lineToQuadratic([p0, p1]);
}


export { geomOf$ }
