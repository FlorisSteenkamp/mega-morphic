import type { PathAlignDebug } from '../../morph/match-paths/path-align-debug.js';
import { drawFs } from 'flo-draw';
import { resampleAt } from '../../morph/align-branches.js';
import { getG } from '../../draw/get-g.js';

const { hypot, min, max, floor } = Math;

/** Correspondence colors, cycled per matched stretch (same on both svgs).
 *  Must be classes defined in style.css - unknown classes render invisibly. */
const palette = [
    'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'deeppink'
];
/** Fattest = best match, thinnest = worst. */
const widthClasses = ['thin400', 'thin200', 'thin140', 'thin80', 'thin40'];

/** a gapped stretch: a gray band (as wide as a matched one) ... */
const GAP_CLASSES = 'thin140 gray nofill';
/** ... with a black core */
const GAP_CORE_CLASSES = 'thin20 black nofill';
/** the point of the other glyph a gap collapses onto */
const WAIT_DOT_CLASSES = 'black nostroke';
/** the routes' start (the alignment runs from here) */
const START_RING_CLASSES = 'thin20 black nofill';


/**
 * Draws a profile alignment into the two svg groups:
 *
 * * matched (diagonal) steps share a color on both sides (cycled per
 *   match), their stroke width by match quality - fattest is best
 *
 * * gapped steps (one side advancing alone) are a gray band with a black
 *   core, and the waiting point on the other side - where that material
 *   collapses to - gets a black dot
 *
 * * unmatched tails are thin gray
 *
 * * a black ring marks where both routes start
 *
 * Returns `false` for degenerate alignments.
 */
function drawAlignSteps(
        g1: SVGGElement,
        g2: SVGGElement,
        al: PathAlignDebug,
        showDelay?: number): boolean {

    // Per-sample skeleton segments (segment k spans samples k..k+1).
    const segsA = resampleAt(al.skelPssA, al.radiiA, al.usA).beziers;
    const segsB = resampleAt(al.skelPssB, al.radiiB, al.usB).beziers;

    const { steps } = al;
    const matches = steps.filter(s => s.state === 0);
    if (matches.length < 2) { return false; }

    const cMax = max(...matches.map(s => s.cost), 1e-12);
    const rA = dotRadius(g1);
    const rB = dotRadius(g2);

    // Each step advances one or both sides by a sample: draw the segment(s)
    // it consumed.
    let k = 0;
    for (let n = 1; n < steps.length; n++) {
        const s0 = steps[n - 1];
        const s1 = steps[n];

        if (s1.state === 0) {
            k++;
            const color = palette[k % palette.length];
            const width = widthClasses[min(
                widthClasses.length - 1,
                floor(s1.cost / cMax * widthClasses.length))];
            const cls = `${width} ${color} nofill`;

            for (let i = s0.i; i < s1.i; i++) {
                drawFs.bezier(g1, segsA[i], cls, showDelay);
            }
            for (let j = s0.j; j < s1.j; j++) {
                drawFs.bezier(g2, segsB[j], cls, showDelay);
            }
        } else if (s1.state === 1) {
            // A advances alone: B waits at sample s1.j
            for (let i = s0.i; i < s1.i; i++) { drawGap(g1, segsA[i], showDelay); }
            drawWait(g2, sampleP(segsB, s1.j), rB, showDelay);
        } else {
            // B advances alone: A waits at sample s1.i
            for (let j = s0.j; j < s1.j; j++) { drawGap(g2, segsB[j], showDelay); }
            drawWait(g1, sampleP(segsA, s1.i), rA, showDelay);
        }
    }

    // Unmatched tails.
    const first = steps[0];
    const last = steps[steps.length - 1];
    drawTail(g1, segsA, 0, first.i, showDelay);
    drawTail(g2, segsB, 0, first.j, showDelay);
    drawTail(g1, segsA, last.i, segsA.length, showDelay);
    drawTail(g2, segsB, last.j, segsB.length, showDelay);

    // where both routes start
    drawFs.circle(g1, { center: sampleP(segsA, 0), radius: 2*rA },
        START_RING_CLASSES, showDelay);
    drawFs.circle(g2, { center: sampleP(segsB, 0), radius: 2*rB },
        START_RING_CLASSES, showDelay);

    return true;
}


/** A gapped segment: a gray band with a black core. */
function drawGap(
        g: SVGGElement,
        ps: number[][],
        showDelay: number | undefined): void {

    drawFs.bezier(g, ps, GAP_CLASSES, showDelay);
    drawFs.bezier(g, ps, GAP_CORE_CLASSES, showDelay);
}


/** The waiting point of a gap on the other glyph: a black dot. */
function drawWait(
        g: SVGGElement,
        p: number[],
        r: number,
        showDelay: number | undefined): void {

    drawFs.circle(g, { center: p, radius: r }, WAIT_DOT_CLASSES, showDelay);
}


/** The skeleton point of sample `k` (segment `k`'s start, or the end). */
function sampleP(
        segs: number[][][],
        k: number): number[] {

    if (k < segs.length) { return segs[k][0]; }
    const last = segs[segs.length - 1];

    return last[last.length - 1];
}


/** A dot radius of about 0.6% of the svg's view box width. */
function dotRadius(g: SVGGElement): number {
    const vb = g.ownerSVGElement?.viewBox.baseVal;

    return vb === undefined || vb.width === 0 ? 3 : 0.006*vb.width;
}


function drawTail(
        g: SVGGElement,
        segs: number[][][],
        from: number,
        to: number,
        showDelay?: number): void {

    for (let i = from; i < to; i++) {
        drawFs.bezier(g, segs[i], 'thin10 gray nofill', showDelay);
    }
}


/** Min distance from `p` to the beziers' control points. */
function distToPss(p: number[], pss: number[][][]): number {
    let d = Infinity;
    for (const ps of pss) {
        for (const q of ps) {
            d = min(d, hypot(q[0] - p[0], q[1] - p[1]));
        }
    }
    return d;
}


function svgGroup(id: string): SVGGElement | undefined {
    return getG(document.getElementById(id));
}


export { drawAlignSteps, distToPss, svgGroup }
