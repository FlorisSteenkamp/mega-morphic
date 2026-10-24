// TEMP: timing of the staggered morph stages. DELETE after profiling.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
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


describe('temp perf', () => {
    test('stages', () => {
        const font = parseSvgFont(
            readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const pairs = (process.env.PAIRS ?? 'k:x,M:N,T:A,E:F').split(',').map(p => p.split(':'));
        const lines: string[] = [];

        for (const [nA, nB] of pairs) {
            let t0 = performance.now();
            const matsA = findMats(getPathsFromStr(dOf(nA)), options);
            const matsB = findMats(getPathsFromStr(dOf(nB)), options);
            const cA = matsA.map(prepareStaggered);
            const cB = matsB.map(prepareStaggered);
            const tMat = performance.now() - t0;

            // as the app: morph debug on (after findMats - flo-boolean's
            // debug branches crash on a bare object)
            if (process.env.DEBUG_ON === '1') {
                (globalThis as any)._debug_ = {
                    elems: { pathMatchResult: [], trunkCands: [] },
                    timing: {}, fs: {}, directives: {}
                };
            }

            t0 = performance.now();
            const entries = buildGlyphMorphEntries(
                matsA.map((m, i) => ({ cp: m.cpNode, coarse: cA[i].cpNode })),
                matsB.map((m, i) => ({ cp: m.cpNode, coarse: cB[i].cpNode })),
                defaultPathWeights);
            const tBuild = performance.now() - t0;
            delete (globalThis as any)._debug_;

            t0 = performance.now();
            const n = 20;
            for (let i = 0; i <= n; i++) { resolveMorphAt(entries, i/n); }
            const tFrame = (performance.now() - t0)/(n + 1);

            lines.push(`${nA}->${nB}: MATs ${tMat.toFixed(0)}ms  build ${
                tBuild.toFixed(0)}ms  frame ${tFrame.toFixed(1)}ms  (${entries.length} entries)`);
        }

        writeFileSync(resolve('temp-perf.txt'), lines.join('\n'));
    }, 600000);
});
