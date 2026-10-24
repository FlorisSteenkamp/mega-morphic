// TEMP: the DTW view's alignments are well-formed matcher paths. DELETE after.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
import { prepareStaggered, STAGGER_FINE } from '../../src/morph/staggered-sat.js';
import { buildGlyphMorphEntries } from '../../src/morph/build-morph-entries/build-glyph-morph-entries.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';
import type { SegMatchedPair } from '../../src/morph/segment-tree/match-seg-trees/seg-matched-pair.js';

const options = { applySat: true, simplify: false, satScale: STAGGER_FINE, maxCurviness: 0.25,
    maxLength: 10, angleIncrement: 15, simplifyTolerance: 2**-5 };

describe('temp align view', () => {
    test('paths', () => {
        const font = parseSvgFont(readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const lines: string[] = [];
        for (const [nA, nB] of [['E','F'],['k','x'],['M','N'],['T','A']]) {
            const matsA = findMats(getPathsFromStr(dOf(nA)), options);
            const matsB = findMats(getPathsFromStr(dOf(nB)), options);
            const cA = matsA.map(prepareStaggered); const cB = matsB.map(prepareStaggered);
            const g = globalThis as any;
            g._debug_ = { elems: { pathMatchResult: [], trunkCands: [] }, timing: {}, fs: {}, directives: {} };
            buildGlyphMorphEntries(
                matsA.map((m, i) => ({ cp: m.cpNode, coarse: cA[i].cpNode })),
                matsB.map((m, i) => ({ cp: m.cpNode, coarse: cB[i].cpNode })), defaultPathWeights);
            const trunk: SegMatchedPair = g._debug_.elems.pathMatchResult[0].trunk;
            delete g._debug_;

            let pairs = 0, aligned = 0, bad = 0;
            const walk = (p: SegMatchedPair) => {
                pairs++;
                const al = p.align;
                if (al !== undefined) {
                    aligned++;
                    const { steps, usA, usB } = al;
                    let ok = steps[0].i === 0 && steps[0].j === 0 && steps[0].state === 0 &&
                        steps.at(-1)!.i === usA.length - 1 && steps.at(-1)!.j === usB.length - 1 &&
                        usA[0] === 0 && usB[0] === 0 &&
                        Math.abs(usA.at(-1)! - 1) < 1e-9 && Math.abs(usB.at(-1)! - 1) < 1e-9;
                    for (let k = 1; k < steps.length && ok; k++) {
                        const di = steps[k].i - steps[k - 1].i, dj = steps[k].j - steps[k - 1].j;
                        const want = steps[k].state === 0 ? [1, 1] : steps[k].state === 1 ? [1, 0] : [0, 1];
                        ok = di === want[0] && dj === want[1];
                    }
                    for (let k = 1; k < usA.length && ok; k++) { ok = usA[k] >= usA[k - 1]; }
                    for (let k = 1; k < usB.length && ok; k++) { ok = usB[k] >= usB[k - 1]; }
                    if (!ok) {
                        bad++;
                        const dup = (us: number[]) => us.findIndex((u, k) => k > 0 && !(u > us[k - 1]));
                        lines.push(`  bad: steps ${steps.length} first ${JSON.stringify(steps[0])} last ${
                            JSON.stringify(steps.at(-1))} nA ${usA.length} nB ${usB.length} uA ${usA[0]}..${usA.at(-1)} uB ${
                            usB[0]}..${usB.at(-1)} nonincA@${dup(usA)} nonincB@${dup(usB)} lens ${
                            p.routeA.length}/${p.routeB.length}`);
                        if (dup(usA) > 0) { lines.push(`    usA around: ${usA.slice(dup(usA) - 2, dup(usA) + 2).join(', ')}`); }
                        if (dup(usB) > 0) { lines.push(`    usB around: ${usB.slice(dup(usB) - 2, dup(usB) + 2).join(', ')}`); }
                    }
                }
                for (const op of p.ops) { if (op.type === 'match') { walk(op.sub); } }
            };
            walk(trunk);
            lines.push(`${nA}->${nB}: pairs ${pairs}, aligned ${aligned}, malformed ${bad}`);
        }
        writeFileSync(resolve('temp-align-view.txt'), lines.join('\n'));
    }, 600000);
});
