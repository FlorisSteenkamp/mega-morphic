import type { PathAlignDebug } from '../../morph/match-paths/matched-path.js';
import { drawFs } from 'flo-draw';
import { resampleAt } from '../../morph/align-branches.js';

const { hypot, min, max, floor } = Math;

/** Correspondence colors, cycled per matched stretch (same on both svgs).
 *  Must be classes defined in style.css - unknown classes render invisibly. */
const palette = [
    'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'deeppink'
];
/** Fattest = best match, thinnest = worst. */
const widthClasses = ['thin100', 'thin50', 'thin35', 'thin20', 'thin10'];


/**
 * Draws a profile alignment into the two svg groups: matched stretches share
 * a color (cycled) on both sides, stroke width scales with match quality,
 * unmatched tails are gray. Returns `false` for degenerate alignments.
 */
function drawAlignSteps(
        g1: SVGGElement,
        g2: SVGGElement,
        al: PathAlignDebug,
        showDelay?: number): boolean {

    // Per-sample skeleton segments (segment k spans samples k..k+1).
    const segsA = resampleAt(al.skelPssA, al.radiiA, al.usA).beziers;
    const segsB = resampleAt(al.skelPssB, al.radiiB, al.usB).beziers;

    const matches = al.steps.filter(s => s.state === 0);
    if (matches.length < 2) { return false; }

    const cMax = max(...matches.map(s => s.cost), 1e-12);

    // Matched stretches (incl. gap-consumed samples leading up to each
    // match): same color both sides, width by the match's relative cost.
    for (let k = 1; k < matches.length; k++) {
        const m0 = matches[k - 1];
        const m1 = matches[k];
        const color = palette[k % palette.length];
        const width = widthClasses[min(
            widthClasses.length - 1,
            floor(m1.cost / cMax * widthClasses.length))];

        for (let i = m0.i; i < m1.i; i++) {
            drawFs.bezier(g1, segsA[i], `${width} ${color} nofill`, showDelay);
        }
        for (let j = m0.j; j < m1.j; j++) {
            drawFs.bezier(g2, segsB[j], `${width} ${color} nofill`, showDelay);
        }
    }

    // Unmatched tails.
    drawTail(g1, segsA, 0, matches[0].i, showDelay);
    drawTail(g2, segsB, 0, matches[0].j, showDelay);
    drawTail(g1, segsA, matches[matches.length - 1].i, segsA.length, showDelay);
    drawTail(g2, segsB, matches[matches.length - 1].j, segsB.length, showDelay);

    return true;
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
    const svg = document.getElementById(id);
    return svg?.getElementsByTagName('g')[0];
}


export { drawAlignSteps, distToPss, svgGroup }
