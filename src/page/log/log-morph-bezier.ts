import type { PageData } from '../page-data.js';
import { closestPointOnBezier } from 'flo-bezier3';
import { drawFs } from 'flo-draw';
import { resolveMorphAt } from '../../morph/resolve-morph-at/resolve-morph-at.js';
import { poseCorrectionAt } from '../../morph/pose-ramp.js';
import { procrustes } from '../../morph/procrustes/procrustes-analysis.js';
import { XMLNS } from '../../draw/xmlns.js';


/**
 * Click tool for the MORPH svg: highlights the boundary bezier of the
 * morphed outline (at the current slider t) closest to the click, with its
 * control points as dots and the thin control polygon lines.
 */
function logMorphBezier(
        refPageData: React.RefObject<PageData | null>) {

    return (g: SVGGElement, p: number[], showDelay = 1000): void => {
        const pd = refPageData.current;
        const entries = pd?.morphRef.current;
        if (pd === null || entries === null || entries === undefined) {
            console.log('no morph yet - click morph first');
            return;
        }

        const t = pd.morphT / 100;
        let { outlines } = resolveMorphAt(entries, t);

        // Match the DRAWN shape exactly - it may be pose-corrected.
        const ramp = pd.morphPoseRef.current;
        if (ramp !== null && outlines.length > 0) {
            const measured = procrustes(outlines.flat());
            const { tf } = poseCorrectionAt(ramp, t, measured);
            outlines = outlines.map(loop => loop.map(ps => ps.map(tf)));
        }

        let bestPs: number[][] | undefined;
        let bestD = Infinity;
        for (const loop of outlines) {
            for (const ps of loop) {
                const { d } = closestPointOnBezier(ps, p);
                if (d < bestD) { bestD = d; bestPs = ps; }
            }
        }
        if (bestPs === undefined) {
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
            $c.setAttributeNS(null, 'r', '1');
            $c.setAttributeNS(null, 'class', 'red nostroke');
            g.appendChild($c);
            els.push($c);
        }

        if (showDelay) {
            setTimeout(() => { for (const $ of els) { $.remove(); } },
                showDelay);
        }

        console.log('morphed bezier:', bestPs, `dist ${bestD.toFixed(2)}`);
    };
}


export { logMorphBezier }
