import type { PathAlignDebug } from '../../morph/match-paths/path-align-debug.js';
import { drawFs } from 'flo-draw';
import { resampleAt } from '../../morph/align-branches.js';
import { calcSkelCumKnots } from '../../morph/fs/skeleton-knots.js';
import { getLastP } from '../../morph/fs/get-last-p.js';
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
/** where the DP started (the alignment runs from here) */
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
 * * a black ring marks where the DP started on both routes: their starts,
 *   or for a child pair their ends (its junctions, `dp.fromEnds`)
 *
 * Returns `false` for degenerate alignments.
 */
function drawAlignSteps(
        g1: SVGGElement,
        g2: SVGGElement,
        al: PathAlignDebug,
        showDelay?: number): boolean {

    // Per-sample skeleton pieces (interval k spans samples k..k+1).
    const { pieces: segsA, points: ptsA } =
        calcSamplePieces(al.skelPssA, al.radiiA, al.usA);
    const { pieces: segsB, points: ptsB } =
        calcSamplePieces(al.skelPssB, al.radiiB, al.usB);

    const { steps } = al;
    const matches = steps.filter(s => s.state === 0);
    if (matches.length < 2) { return false; }

    const cMax = max(...matches.map(s => s.cost), 1e-12);
    const rA = dotRadius(g1);
    const rB = dotRadius(g2);

    // the diagonal moves, numbered from where the DP started (the first one
    // red): from the routes' starts, or (a child pair) from their ends
    const diagCount = steps.slice(1).filter(s => s.state === 0).length;

    // Each step advances one or both sides by a sample: draw the segment(s)
    // it consumed.
    let k = 0;
    for (let n = 1; n < steps.length; n++) {
        const s0 = steps[n - 1];
        const s1 = steps[n];

        if (s1.state === 0) {
            const fromStart = al.dp.fromEnds ? diagCount - 1 - k : k;
            k++;
            const color = palette[fromStart % palette.length];
            const width = widthClasses[min(
                widthClasses.length - 1,
                floor(s1.cost / cMax * widthClasses.length))];
            const cls = `${width} ${color} nofill`;

            for (let i = s0.i; i < s1.i; i++) {
                for (const ps of segsA[i]) { drawFs.bezier(g1, ps, cls, showDelay); }
            }
            for (let j = s0.j; j < s1.j; j++) {
                for (const ps of segsB[j]) { drawFs.bezier(g2, ps, cls, showDelay); }
            }
        } else if (s1.state === 1) {
            // A advances alone: B waits at sample s1.j
            for (let i = s0.i; i < s1.i; i++) {
                for (const ps of segsA[i]) { drawGap(g1, ps, showDelay); }
            }
            drawWait(g2, ptsB[s1.j], rB, showDelay);
        } else {
            // B advances alone: A waits at sample s1.i
            for (let j = s0.j; j < s1.j; j++) {
                for (const ps of segsB[j]) { drawGap(g2, ps, showDelay); }
            }
            drawWait(g1, ptsA[s1.i], rA, showDelay);
        }
    }

    // Unmatched tails.
    const first = steps[0];
    const last = steps[steps.length - 1];
    drawTail(g1, segsA, 0, first.i, showDelay);
    drawTail(g2, segsB, 0, first.j, showDelay);
    drawTail(g1, segsA, last.i, segsA.length, showDelay);
    drawTail(g2, segsB, last.j, segsB.length, showDelay);

    // where the DP started: the routes' starts, or (a child pair) their
    // ends - its junctions
    const startA = al.dp.fromEnds ? ptsA[ptsA.length - 1] : ptsA[0];
    const startB = al.dp.fromEnds ? ptsB[ptsB.length - 1] : ptsB[0];
    drawFs.circle(g1, { center: startA, radius: 2*rA },
        START_RING_CLASSES, showDelay);
    drawFs.circle(g2, { center: startB, radius: 2*rB },
        START_RING_CLASSES, showDelay);

    return true;
}


/**
 * Returns the skeleton cut at the samples: per sample interval the pieces
 * covering it (`pieces[k]` spans samples `k`..`k + 1`), and each sample's
 * point.
 *
 * * an interval may span several of the skeleton's beziers (the matcher
 *   samples by arc length, not at its beziers' ends), so the skeleton is
 *   cut at the samples and the bezier ends together (`resampleAt` needs
 *   each interval within one bezier) and an interval gets all the pieces
 *   between its samples
 *
 * * an interval of no length (samples on a zero-length segment) has no
 *   pieces
 *
 * @param bz the skeleton
 * @param radii its radii per bezier end
 * @param us the samples' positions (fractions of its length, ascending)
 */
function calcSamplePieces(
        bz: number[][][],
        radii: number[],
        us: number[]): { pieces: number[][][][]; points: number[][] } {

    const cuts = [...new Set([...us, ...calcSkelCumKnots(bz)])]
        .toSorted((a, b) => a - b);
    const cutPieces = resampleAt(bz, radii, cuts).beziers;

    const at = new Map(cuts.map((u, m) => [u, m]));
    const pointAt = (m: number): number[] => m < cutPieces.length
        ? cutPieces[m][0]
        : getLastP(cutPieces);

    return {
        pieces: us.slice(0, -1).map((u, k) =>
            cutPieces.slice(at.get(u)!, at.get(us[k + 1])!)),
        points: us.map(u => pointAt(at.get(u)!))
    };
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


/** A dot radius of about 0.6% of the svg's view box width. */
function dotRadius(g: SVGGElement): number {
    const vb = g.ownerSVGElement?.viewBox.baseVal;

    return vb === undefined || vb.width === 0 ? 3 : 0.006*vb.width;
}


function drawTail(
        g: SVGGElement,
        segs: number[][][][],
        from: number,
        to: number,
        showDelay?: number): void {

    for (let i = from; i < to; i++) {
        for (const ps of segs[i]) {
            drawFs.bezier(g, ps, 'thin10 gray nofill', showDelay);
        }
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
