// TEMP: counts route-pair pricings. DELETE after profiling.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
import { prepareStaggered, STAGGER_FINE } from '../../src/morph/staggered-sat.js';
import { buildGlyphMorphEntries } from '../../src/morph/build-morph-entries/build-glyph-morph-entries.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const options = { applySat: true, simplify: false, satScale: STAGGER_FINE, maxCurviness: 0.25,
    maxLength: 10, angleIncrement: 15, simplifyTolerance: 2**-5 };

describe('temp rpc', () => {
    test('counts', () => {
        const font = parseSvgFont(readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const lines: string[] = [];
        for (const [nA, nB] of [['k','x'],['M','N'],['T','A'],['E','F'],['six','seven'],['C','B'],['A','H'],['seven','three']]) {
            const matsA = findMats(getPathsFromStr(dOf(nA)), options);
            const matsB = findMats(getPathsFromStr(dOf(nB)), options);
            const cA = matsA.map(prepareStaggered); const cB = matsB.map(prepareStaggered);
            const g = globalThis as any;
            g.__rpc = { calls: 0, keys: new Set(), ids: new Map() };
            const ids = new Map(); g.__cmpDtw = { n: 0, bad: 0, id: (o: object) => ids.get(o) ?? (ids.set(o, ids.size), ids.size - 1) };
            buildGlyphMorphEntries(
                matsA.map((m, i) => ({ cp: m.cpNode, coarse: cA[i].cpNode })),
                matsB.map((m, i) => ({ cp: m.cpNode, coarse: cB[i].cpNode })), defaultPathWeights);
            lines.push(`${nA}->${nB}: single-start DTWs ${g.__cmpDtw.n}, mismatches ${g.__cmpDtw.bad}`); delete g.__cmpDtw;
            delete g.__rpc;
        }
        writeFileSync(resolve('temp-rpc.txt'), lines.join('\n'));
    }, 600000);
});
