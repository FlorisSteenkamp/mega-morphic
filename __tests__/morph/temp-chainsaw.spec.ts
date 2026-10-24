// TEMP check of the chainsaw drawing: t=0/1 reproduce the glyphs, no NaNs
// mid-morph. DELETE after the experiment.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
import { evalDeCasteljau } from 'flo-bezier3';
import { prepareStaggered, STAGGER_FINE } from '../../src/morph/staggered-sat.js';
import { buildGlyphMorphEntries } from '../../src/morph/build-morph-entries/build-glyph-morph-entries.js';
import { resolveMorphAt } from '../../src/morph/resolve-morph-at/resolve-morph-at.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';


const options = {
    applySat: true,
    simplify: false,
    satScale: STAGGER_FINE,
    maxCurviness: 0.25,
    maxLength: 10,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

const N = 160;


/** polygonized loops */
function polys(loops: number[][][][]): number[][][] {
    return loops.map(loop => loop.flatMap(ps =>
        [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
            .map(t => evalDeCasteljau(ps, t))));
}


function winding(poly: number[][], x: number, y: number): number {
    let w = 0;
    for (let i = 0; i < poly.length; i++) {
        const [x0, y0] = poly[i];
        const [x1, y1] = poly[(i + 1) % poly.length];
        if (y0 <= y) {
            if (y1 > y && (x1 - x0)*(y - y0) - (x - x0)*(y1 - y0) > 0) { w++; }
        } else if (y1 <= y && (x1 - x0)*(y - y0) - (x - x0)*(y1 - y0) < 0) { w--; }
    }
    return w;
}


/** grid coverage: per cell, inside any of the polys (nonzero winding) */
function coverage(ps: number[][][], box: number[][], nonzero: boolean): boolean[] {
    const [[x0, y0], [x1, y1]] = box;
    const cells: boolean[] = [];
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const x = x0 + (i + 0.5)*(x1 - x0)/N;
            const y = y0 + (j + 0.5)*(y1 - y0)/N;
            if (nonzero) {
                cells.push(ps.some(p => winding(p, x, y) !== 0));
            } else {
                // glyph: total winding of all loops
                cells.push(ps.reduce((s, p) => s + winding(p, x, y), 0) !== 0);
            }
        }
    }
    return cells;
}


function bboxOf(ps: number[][][]): number[][] {
    const xs = ps.flat().map(p => p[0]);
    const ys = ps.flat().map(p => p[1]);
    const pad = 20;
    return [[Math.min(...xs) - pad, Math.min(...ys) - pad],
            [Math.max(...xs) + pad, Math.max(...ys) + pad]];
}


describe('temp chainsaw check', () => {
    test('glyph pairs', () => {
        const font = parseSvgFont(
            readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const lines: string[] = [];
        const mids: Record<string, string> = {};

        for (const [nA, nB] of [['k', 'x'], ['M', 'N'], ['T', 'A'], ['six', 'seven'], ['C', 'B']]) {
            const loopsA = getPathsFromStr(dOf(nA));
            const loopsB = getPathsFromStr(dOf(nB));
            const matsA = findMats(loopsA, options);
            const matsB = findMats(loopsB, options);
            const cA = matsA.map(prepareStaggered);
            const cB = matsB.map(prepareStaggered);
            const entries = buildGlyphMorphEntries(
                matsA.map((m, i) => ({ cp: m.cpNode, coarse: cA[i].cpNode })),
                matsB.map((m, i) => ({ cp: m.cpNode, coarse: cB[i].cpNode })),
                defaultPathWeights);

            const shears = entries.map(e => {
                const d = (s: typeof e.sleeveOut) =>
                    Math.max(0, ...((s as any).idxA ?? []).map((k: number, c: number) =>
                        Math.abs(k - (s as any).idxB[c])));
                return Math.max(d(e.sleeveOut), d(e.sleeveBack));
            });

            const report: string[] = [];
            for (const t of [0, 0.25, 0.5, 0.75, 1]) {
                const r = resolveMorphAt(entries, t);
                const nan = r.outlines.flat(3).some(x => !Number.isFinite(x));
                let xor = '';
                if (t === 0 || t === 1) {
                    const glyph = polys(t === 0 ? loopsA : loopsB);
                    const box = bboxOf(glyph);
                    const g = coverage(glyph, box, false);
                    const m = coverage(polys(r.outlines), box, true);
                    const diff = g.filter((v, k) => v !== m[k]).length;
                    xor = ` xor ${diff}/${g.filter(v => v).length}`;
                }
                report.push(`t${t}: ${r.outlines.length} loops${nan ? ' NaN!' : ''}${xor}`);
            }
            { const r = resolveMorphAt(entries, 0.5); const box = bboxOf([...polys(loopsA), ...polys(loopsB)]); mids[nA + nB] = coverage(polys(r.outlines), box, true).map(v => v ? 1 : 0).join(""); }
            lines.push(`${nA}->${nB}: ${entries.length} entries, max idx shift ${
                Math.max(...shears).toFixed(1)}  |  ${report.join('  ')}`);
        }

        writeFileSync(resolve('temp-chainsaw.txt'), lines.join('\n'));
        writeFileSync(resolve('temp-chainsaw-mid.json'), JSON.stringify(mids));
    }, 300000);
});
