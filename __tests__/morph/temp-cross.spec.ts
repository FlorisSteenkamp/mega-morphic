// TEMP: does a matched child pass a deleted one along their parent?
// DELETE after diagnosis.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
import { prepareStaggered, STAGGER_FINE } from '../../src/morph/staggered-sat.js';
import { buildGlyphMorphEntries } from '../../src/morph/build-morph-entries/build-glyph-morph-entries.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';
import { getLastP } from '../../src/morph/fs/get-last-p.js';
import { pAtIndex } from '../../src/morph/fs/p-at-idx.js';
import type { MorphEntry } from '../../src/morph/morph-entry.js';


const options = {
    applySat: true,
    simplify: false,
    satScale: STAGGER_FINE,
    maxCurviness: 0.25,
    maxLength: 10,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};


/** side of the child's junction direction relative to the parent (real frame) */
function sideOf(entries: MorphEntry[], i: number, frame: 'a' | 'b'): number {
    const e = entries[i];
    const pss = frame === 'a' ? e.skelPssA : e.skelPssB;
    const g = e.glue!;
    const k = frame === 'a' ? g.k1 : g.k2;
    const par = entries[g.e];
    const ppss = frame === 'a' ? par.skelPssA : par.skelPssB;
    const p = pAtIndex(ppss, k);
    const q = pAtIndex(ppss, Math.min(k + 0.5, ppss.length));
    const p0 = pAtIndex(ppss, Math.max(k - 0.5, 0));
    const T = [q[0] - p0[0], q[1] - p0[1]];
    // a point into the child, away from the junction
    let c = getLastP(pss);
    for (let j = pss.length - 1; j >= 0; j--) {
        const x = pss[j][0];
        if (Math.hypot(x[0] - p[0], x[1] - p[1]) > 5) { c = x; break; }
    }
    return Math.sign(T[0]*(c[1] - p[1]) - T[1]*(c[0] - p[0]));
}


describe('temp crossing check', () => {
    test('six → seven', () => {
        const font = parseSvgFont(
            readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const matsA = findMats(getPathsFromStr(dOf('six')), options);
        const matsB = findMats(getPathsFromStr(dOf('seven')), options);
        const cA = matsA.map(prepareStaggered);
        const cB = matsB.map(prepareStaggered);
        const entries = buildGlyphMorphEntries(
            matsA.map((m, i) => ({ cp: m.cpNode, coarse: cA[i].cpNode })),
            matsB.map((m, i) => ({ cp: m.cpNode, coarse: cB[i].cpNode })),
            defaultPathWeights);

        const lines: string[] = [];
        entries.forEach((e, i) => {
            const g = e.glue;
            const real: 'a' | 'b' = e.collapsed === 'a' ? 'b' : 'a';
            lines.push(`${i} ${e.classes.split(' ')[0]}${e.collapsed ? ` collapsed:${e.collapsed}` : ''}${
                g ? ` glue e${g.e} k1 ${g.k1.toFixed(1)} k2 ${g.k2.toFixed(1)} side ${sideOf(entries, i, real)}` : ''}`);
        });

        {
            const { sleeveOut: o, sleeveBack: b } = entries[0];
            const near = (s: typeof o) => s.idxA
                .map((a, c) => [a, s.idxB[c]])
                .filter(([a, bb]) => (a >= 280 && a <= 470) || (bb >= 280 && bb <= 470))
                .filter((_, c, arr) => c === 0 || c === arr.length - 1 || arr[c][0] !== arr[c][1] || arr[c-1][0] !== arr[c-1][1])
                .map(([a, bb]) => `${a}→${bb}`).join(' ');
            lines.push(`trunk out cuts (idxA→idxB) near 280-470: ${near(o)}`);
            lines.push(`trunk back cuts (idxA→idxB) near 280-470: ${near(b)}`);
            const sinVote = (rows: number[][]) => rows.reduce((s, r) =>
                s + [r[0], r[2]].filter(x => !Number.isNaN(x)).reduce((t, x) => t + Math.sign(Math.sin(x)), 0), 0);
            lines.push(`trunk out sleeve sin vote A ${sinVote(o.anchorsA)} B ${sinVote(o.anchorsB)}`);
        }

        lines.push('', 'crossings (matched child passes a topology child on the same parent + side):');
        entries.forEach((m, i) => {
            if (m.glue === undefined || m.collapsed !== undefined) { return; }
            const sm = sideOf(entries, i, 'a');
            entries.forEach((d, j) => {
                if (d.glue === undefined || d.collapsed === undefined ||
                    d.glue.e !== m.glue!.e) { return; }
                const real: 'a' | 'b' = d.collapsed === 'a' ? 'b' : 'a';
                const { k1, k2 } = d.glue;
                const sd = sideOf(entries, j, real);
                if ((m.glue!.k1 - k1)*(m.glue!.k2 - k2) < 0) {
                    lines.push(`  matched ${i} (${m.classes.split(' ')[0]}, side ${sm}) k ${
                        m.glue!.k1.toFixed(1)}→${m.glue!.k2.toFixed(1)} passes topology ${j} (${
                        real === 'a' ? 'deleted' : 'inserted'}, side ${sd}) k ${k1.toFixed(1)}→${
                        k2.toFixed(1)}${sm === sd ? '  SAME SIDE' : ''}`);
                }
            });
        });

        writeFileSync(resolve('temp-cross.txt'), lines.join('\n'));
    }, 300000);
});
