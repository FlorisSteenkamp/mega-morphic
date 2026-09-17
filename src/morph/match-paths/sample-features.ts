import type { Samples } from './samples.js';
import { length } from 'flo-bezier3';
import { unwrappedChordAngles } from '../intrinsic-skeleton/unwrapped-chord-angles.js';
import { clamp } from '../../utils/clamp.js';

const { max, min } = Math;


/**
 * Radius + turning-rate profile, start (u=0) → end (u=1).
 * 
 * @param pss
 * @param rd
 * @param unit
 * @param maxN
 */
function sampleFeatures(
        pss: number[][][],
        rd: number[],
        unit: number,
        maxN: number): Samples {

    const n = clamp(2 * pss.length, min(24, maxN), maxN);

    const lens = pss.map(ps => length([0, 1], ps));
    const total = lens.reduce((s, l) => s + l, 0);
    const knots = [0];
    let cum = 0;
    for (const l of lens) {
        cum += l;
        knots.push(total > 0 ? cum / total : 0);
    }
    knots[knots.length - 1] = 1;

    const φs = padProfile(unwrappedChordAngles(pss), rd.length);

    const u: number[] = [];
    const r: number[] = [];
    const φ: number[] = [];
    for (let i = 0; i < n; i++) {
        const ui = i / (n - 1);
        u.push(ui);
        r.push(valueAt(rd, knots, ui) / unit);
        φ.push(valueAt(φs, knots, ui));
    }

    const turn: number[] = [];
    for (let i = 0; i < n; i++) {
        const i0 = max(0, i - 1);
        const i1 = min(n - 1, i + 1);
        turn.push((φ[i1] - φ[i0]) / (u[i1] - u[i0]));
    }

    return { u, r, turn };
}


/** Chord angles live per segment (rd is per boundary): pad to align. */
function padProfile(φs: number[], m: number): number[] {
    const out = φs.slice();
    while (out.length < m) { out.push(out[out.length - 1] ?? 0); }
    return out;
}


/** Piecewise-linear value over `knots` at normalized position `u`. */
function valueAt(vals: number[], knots: number[], u: number): number {
    let j = 0;
    while (j < knots.length - 2 && knots[j + 1] <= u) { j++; }
    const span = knots[j + 1] - knots[j];
    const f = span <= 0 ? 0 : clamp((u - knots[j]) / span, 0, 1);

    return vals[j]*(1 - f) + vals[min(j + 1, vals.length - 1)]*f;
}


export { sampleFeatures }