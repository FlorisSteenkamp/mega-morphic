import type { MorphEntry, SideRes } from './morph-entry.js';
import { evalDeCasteljau, getTAtLength, length } from 'flo-bezier3';
import { envelopeContacts } from './boundary-residuals.js';
import { getUnitTangent } from './get-unit-tangent.js';
import { toPolylineLoop } from './to-poly-line-loop.js';

const { atan2, min, max, cos, sin, abs, ceil, PI: π } = Math;


/**
 * The residual-corrected outline of one entry at time `t`: per residual
 * position, the envelope contact is rebuilt in the DRAWN frame, each glyph's
 * residual added back, and the two reconstructions blended by `t`; the two
 * sides are closed with disk cap arcs at the tips.
 */
function reconstructOutline(
        entry: MorphEntry,
        bz: number[][][],
        radii: number[],
        t: number): number[][][] | undefined {

    const { us, residuals } = entry;
    if (us === undefined || residuals === undefined) { return undefined; }

    const segLens = bz.map(ps => length([0, 1], ps));

    const outPts: number[][] = [];
    const backPts: number[][] = [];
    let j = 0;
    for (let i = 0; i < residuals.us.length; i++) {
        const u = residuals.us[i];
        while (j < bz.length - 1 && us[j + 1] < u) { j++; }

        const span = us[j + 1] - us[j];
        const f = span <= 0 ? 0 : max(0, min(1, (u - us[j]) / span));

        const tj = segLens[j] === 0
            ? f
            : max(0, min(1, getTAtLength(bz[j], f*segLens[j])));
        const p = evalDeCasteljau(bz[j], tj);
        const T = getUnitTangent(bz[j], tj);
        const N = [-T[1], T[0]];
        const r = radii[j]*(1 - f) + radii[j + 1]*f;
        const dr = segLens[j] === 0
            ? 0
            : max(-1, min(1, (radii[j + 1] - radii[j]) / segLens[j]));

        const contacts = envelopeContacts(p, T, r, dr);
        const pt = (resA: SideRes, resB: SideRes): number[] => {
            const rec = (res: SideRes): number[] => {
                const c = res.sigma === 1 ? contacts.plus : contacts.minus;
                return [
                    c[0] + res.rT*T[0] + res.sigma*res.rN*N[0],
                    c[1] + res.rT*T[1] + res.sigma*res.rN*N[1],
                ];
            };
            const pA = rec(resA);
            const pB = rec(resB);
            return [pA[0]*(1 - t) + pB[0]*t, pA[1]*(1 - t) + pB[1]*t];
        };

        outPts.push(pt(residuals.outA[i], residuals.outB[i]));
        backPts.push(pt(residuals.backA[i], residuals.backB[i]));
    }

    if (outPts.length < 2) { return undefined; }

    // Tip frames for the caps.
    const n = outPts.length;
    const rStart = radii[0];
    const rEnd = radii[radii.length - 1];
    const pStart = evalDeCasteljau(bz[0], 0);
    const pEnd = evalDeCasteljau(bz[bz.length - 1], 1);
    const tStart = getUnitTangent(bz[0], 0);
    const tEnd = getUnitTangent(bz[bz.length - 1], 1);

    // Runs out → back around the u=1 tip.
    const endCap =
        capArcPts(pEnd, rEnd, outPts[n - 1], backPts[n - 1], tEnd);
    // Runs back → out around the u=0 tip.
    const startCap =
        capArcPts(
            pStart, rStart, backPts[0], outPts[0],
            [-tStart[0], -tStart[1]]);

    return toPolylineLoop([
        ...outPts,
        ...endCap,
        ...[...backPts].reverse(),
        ...startCap,
    ]);
}


/** Interior points of the arc of the disk at `p` from `from` to `to`,
 *  sweeping through the side `throughDir` points at. */
function capArcPts(
        p: number[],
        r: number,
        from: number[],
        to: number[],
        throughDir: number[],
        capSteps = 16): number[][] {

    if (r < 1e-6) { return []; }

    const a0 = atan2(from[1] - p[1], from[0] - p[0]);
    const a1 = atan2(to[1] - p[1], to[0] - p[0]);

    const ccw = ((a1 - a0) % (2*π) + 2*π) % (2*π);
    const candidates = [ccw, ccw - 2*π];
    let sweep = candidates[0];
    let best = -Infinity;
    for (const s of candidates) {
        const mid = a0 + s/2;
        const d = cos(mid)*throughDir[0] + sin(mid)*throughDir[1];
        if (d > best) { best = d; sweep = s; }
    }

    const steps = max(2, ceil(capSteps * abs(sweep) / (2*π)));
    const out: number[][] = [];
    for (let k = 1; k < steps; k++) {
        const th = a0 + sweep * (k / steps);
        out.push([p[0] + r*cos(th), p[1] + r*sin(th)]);
    }
    return out;
}


export { reconstructOutline }
