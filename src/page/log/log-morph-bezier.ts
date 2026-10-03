import type { PageData } from '../page-data.js';
import { closestPointOnBezier } from 'flo-bezier3';
import { drawFs } from 'flo-draw';
import { resolveMorphAt } from '../../morph/resolve-morph-at/resolve-morph-at.js';
import { poseCorrectionAt } from '../../morph/procrustes/pose-ramp.js';
import { calcProcrustes } from '../../morph/procrustes/calc-procrustes.js';
import { XMLNS } from '../../draw/xmlns.js';

const { atan2, hypot, abs, min, PI: π } = Math;

/** joints kinked less than this are considered smooth (degrees) */
const KINK_MIN_DEG = 1;


/**
 * Click tool for the MORPH svg: highlights the boundary bezier of the
 * morphed outline (at the current slider t) closest to the click, with its
 * control points as dots and the thin control polygon lines.
 */
function logMorphBezier(
        refPageData: React.RefObject<PageData | null>) {

    return (g: SVGGElement, p: number[], showDelay = 1000): void => {
        const { morphRef, props } = refPageData.current!;
        const { stateControl } = props;
        const { state: { appState } } = stateControl;
        const { morphT, poseOptions } = appState.pageState;
        const { morphPose } = appState.pageState.deduced;
        const entries = morphRef.current;
        
        if (/*pd === null || */entries === null || entries === undefined) {
            console.log('no morph yet - click morph first');
            return;
        }

        const t = morphT / 100;
        let { outlines } = resolveMorphAt(entries, t);

        // Match the DRAWN shape exactly - it may be pose-corrected.
        // const ramp = morphPoseRef.current;
        if (morphPose !== undefined && outlines.length > 0) {
            const measured = calcProcrustes(outlines.flat());
            const { tf } = poseCorrectionAt(poseOptions, morphPose, t, measured);
            outlines = outlines.map(loop => loop.map(ps => ps.map(tf)));
        }

        let bestPs: number[][] | undefined;
        let bestLoop: number[][][] | undefined;
        let bestIdx = -1;
        let bestD = Infinity;
        for (const loop of outlines) {
            for (let i = 0; i < loop.length; i++) {
                const { d } = closestPointOnBezier(loop[i], p);
                if (d < bestD) {
                    bestD = d; bestPs = loop[i]; bestLoop = loop; bestIdx = i;
                }
            }
        }
        if (bestPs === undefined || bestLoop === undefined) {
            console.log('no morphed boundary at this t');
            return;
        }

        drawFs.bezier(g, bestPs, undefined, showDelay);

        // Control polygon (thin lines) + control points (dots).
        const els: SVGElement[] = [];

        const $poly = document.createElementNS(XMLNS, 'path');
        $poly.setAttributeNS(null, 'd',
            'M' + bestPs.map(q => `${q[0]} ${q[1]}`).join(' L '));
        $poly.setAttributeNS(null, 'class', 'red thin2 nofill');
        g.appendChild($poly);
        els.push($poly);

        for (const q of bestPs) {
            const $c = document.createElementNS(XMLNS, 'circle');
            $c.setAttributeNS(null, 'cx', `${q[0]}`);
            $c.setAttributeNS(null, 'cy', `${q[1]}`);
            $c.setAttributeNS(null, 'r', '0.1');
            $c.setAttributeNS(null, 'class', 'red nostroke');
            g.appendChild($c);
            els.push($c);
        }

        if (showDelay) {
            setTimeout(() => { for (const $ of els) { $.remove(); } },
                showDelay);
        }

        // --- G1 kink report: tangent discontinuity at every joint --------
        // (control-point lerp does NOT preserve G1 mid-morph - this shows
        // where and how badly)
        const kinks: number[] = [];
        const kinkEls: SVGElement[] = [];
        for (const loop of outlines) {
            for (let i = 0; i < loop.length; i++) {
                const prev = loop[i];
                const next = loop[(i + 1) % loop.length];
                const dOut = dirAtEnd(prev);
                const dIn = dirAtStart(next);
                if ((dOut[0] === 0 && dOut[1] === 0) ||
                    (dIn[0] === 0 && dIn[1] === 0)) { continue; }
                const kink = abs(atan2(
                    dOut[0]*dIn[1] - dOut[1]*dIn[0],
                    dOut[0]*dIn[0] + dOut[1]*dIn[1])) * 180/π;
                kinks.push(kink);

                // Temp commented
                // if (kink > KINK_MIN_DEG) {
                //     const q = next[0];
                //     const $c = document.createElementNS(XMLNS, 'circle');
                //     $c.setAttributeNS(null, 'cx', `${q[0]}`);
                //     $c.setAttributeNS(null, 'cy', `${q[1]}`);
                //     $c.setAttributeNS(null, 'r',
                //         `${min(1 + kink/4, 6)}`);
                //     $c.setAttributeNS(null, 'class', 'blue nostroke');
                //     g.appendChild($c);
                //     kinkEls.push($c);
                // }
            }
        }
        if (showDelay) {
            setTimeout(() => { for (const $ of kinkEls) { $.remove(); } },
                showDelay);
        }

        const sorted = [...kinks].sort((x, y) => y - x);
        const kinked = sorted.filter(k => k > KINK_MIN_DEG);
        const clickedKinkIn = jointKink(
            bestLoop[(bestIdx - 1 + bestLoop.length) % bestLoop.length],
            bestPs);
        const clickedKinkOut = jointKink(
            bestPs, bestLoop[(bestIdx + 1) % bestLoop.length]);

        console.log('morphed bezier:', {
            bezier: bestPs,
            chordLen: hypot(
                bestPs[bestPs.length - 1][0] - bestPs[0][0],
                bestPs[bestPs.length - 1][1] - bestPs[0][1]).toFixed(2),
            kinkAtStart: `${clickedKinkIn.toFixed(2)}°`,
            kinkAtEnd: `${clickedKinkOut.toFixed(2)}°`,
            outlineKinks: {
                joints: kinks.length,
                [`over ${KINK_MIN_DEG}° (blue dots)`]: kinked.length,
                'max°': sorted[0]?.toFixed(2),
                'top 10': sorted.slice(0, 10).map(k => +k.toFixed(1)),
                'mean°': (kinks.reduce((s, k) => s + k, 0) /
                    (kinks.length || 1)).toFixed(3)
            }
        });
    };
}


/** The tangent kink angle (degrees) at the joint prev→next. */
function jointKink(prev: number[][], next: number[][]): number {
    const dOut = dirAtEnd(prev);
    const dIn = dirAtStart(next);
    return abs(atan2(
        dOut[0]*dIn[1] - dOut[1]*dIn[0],
        dOut[0]*dIn[0] + dOut[1]*dIn[1])) * 180/π;
}


function dirAtStart(ps: number[][]): number[] {
    const p0 = ps[0];
    for (let i = 1; i < ps.length; i++) {
        const d = [ps[i][0] - p0[0], ps[i][1] - p0[1]];
        if (d[0] !== 0 || d[1] !== 0) { return d; }
    }
    return [0, 0];
}


function dirAtEnd(ps: number[][]): number[] {
    const pE = ps[ps.length - 1];
    for (let i = ps.length - 2; i >= 0; i--) {
        const d = [pE[0] - ps[i][0], pE[1] - ps[i][1]];
        if (d[0] !== 0 || d[1] !== 0) { return d; }
    }
    return [0, 0];
}


export { logMorphBezier }
