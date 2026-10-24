// TEMP: the E/F middle-arm pair's traced DTW path as runs. DELETE after.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
import { prepareStaggered, STAGGER_FINE } from '../../src/morph/staggered-sat.js';
import { buildGlyphMorphEntries } from '../../src/morph/build-morph-entries/build-glyph-morph-entries.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';
import { segTreeFromCp } from '../../src/morph/segment-tree/seg-tree-from-cp.js';
import { vertexIds$ } from '../../src/debug/segment-tree/vertex-ids.js';
import { geomOf$ } from '../../src/morph/segment-tree/geom-of.js';
import { routeEndsOf } from '../../src/morph/segment-tree/match-seg-trees/outline-len-of.js';
import type { SegMatchedPair } from '../../src/morph/segment-tree/match-seg-trees/seg-matched-pair.js';

const options = { applySat: true, simplify: false, satScale: STAGGER_FINE, maxCurviness: 0.25,
    maxLength: 10, angleIncrement: 15, simplifyTolerance: 2**-5 };

describe('temp arm path', () => {
    test('runs', () => {
        const font = parseSvgFont(readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const matsA = findMats(getPathsFromStr(dOf('E')), options);
        const matsB = findMats(getPathsFromStr(dOf('F')), options);
        const cA = matsA.map(prepareStaggered); const cB = matsB.map(prepareStaggered);
        const g = globalThis as any;
        g._debug_ = { elems: { pathMatchResult: [], trunkCands: [] }, timing: {}, fs: {}, directives: {} };
        buildGlyphMorphEntries(
            matsA.map((m, i) => ({ cp: m.cpNode, coarse: cA[i].cpNode })),
            matsB.map((m, i) => ({ cp: m.cpNode, coarse: cB[i].cpNode })), defaultPathWeights);
        const trunk: SegMatchedPair = g._debug_.elems.pathMatchResult[0].trunk;
        delete g._debug_;
        const idA = vertexIds$(segTreeFromCp(matsA[0].cpNode));
        const idB = vertexIds$(segTreeFromCp(matsB[0].cpNode));

        const lines: string[] = [];
        const walk = (p: SegMatchedPair) => {
            const [sA, eA] = routeEndsOf(p.routeA);
            const [sB, eB] = routeEndsOf(p.routeB);
            const name = `A ${idA.get(sA)}→${idA.get(eA)}  B ${idB.get(sB)}→${idB.get(eB)}`;
            if (idA.get(sA) === 24 || process.env.ALL === '1') {
                const vA = p.routeA.map(st => idA.get(st.reversed ? geomOf$(st.seg).vertE : geomOf$(st.seg).vertS)).join('>') + '>' + idA.get(eA);
                const vB = p.routeB.map(st => idB.get(st.reversed ? geomOf$(st.seg).vertE : geomOf$(st.seg).vertS)).join('>') + '>' + idB.get(eB);
                lines.push(`${name}  shape ${p.shapeCost.toFixed(4)}  routes ${vA} | ${vB}`);
                const al = p.align!;
                lines.push(`  samples A ${al.usA.length} B ${al.usB.length}`);
                const kinds = ['diag', 'gap: A alone', 'gap: B alone'];
                let k = 1;
                while (k < al.steps.length) {
                    const st = al.steps[k].state;
                    const k0 = k;
                    while (k < al.steps.length && al.steps[k].state === st) { k++; }
                    const s0 = al.steps[k0 - 1], s1 = al.steps[k - 1];
                    lines.push(`  ${kinds[st].padEnd(13)} x${String(k - k0).padStart(3)}  uA ${al.usA[s0.i].toFixed(3)}→${al.usA[s1.i].toFixed(3)}  uB ${al.usB[s0.j].toFixed(3)}→${al.usB[s1.j].toFixed(3)}`);
                }
            }
            for (const op of p.ops) { if (op.type === 'match') { walk(op.sub); } }
        };
        walk(trunk);
        writeFileSync(resolve('temp-arm-path.txt'), lines.join('\n'));
    }, 600000);
});
