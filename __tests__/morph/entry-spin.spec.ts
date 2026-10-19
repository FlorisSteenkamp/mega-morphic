// Regression: no real (non-collapsed) morph entry may spin ~a full turn
// mid-morph (M→N full-MAT trunk/stem spin - the no-net-rotation gauge in
// getMorphedSkeleton$). Probe = length-weighted mean material direction,
// unwrapped over t.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import type { Segment } from '../../src/morph/segment-tree/segment.js';
import { segTreeWithLoop, loopOf } from '../helpers/seg-tree-with-loop.js';
import { buildMorphEntries } from '../../src/morph/build-morph-entries/build-morph-entries.js';
import { resolveMorphAt } from '../../src/morph/resolve-morph-at/resolve-morph-at.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { atan2, hypot, PI: π } = Math;

const options: MatOptions = {
    applySat: false,
    simplify: false,
    satScale: 1.5,
    maxCurviness: 0.25,
    maxLength: 40,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

function loadGraph(glyphName: string): Segment[] {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const loops = getPathsFromStr(d);
    const mats = findMats(loops, options);
    return segTreeWithLoop(mats[0].cpNode);
}

// mean material direction: length-weighted sum of per-bezier chords
const meanDir = (pss: number[][][]): number[] => {
    let x = 0, y = 0;
    for (const ps of pss) {
        x += ps[ps.length - 1][0] - ps[0][0];
        y += ps[ps.length - 1][1] - ps[0][1];
    }
    return [x, y];
};

describe('morph entry spin (M→N, full MAT)', () => {
    test('no non-collapsed entry winds a full turn', () => {
        const gA = loadGraph('M');
        const gB = loadGraph('N');
        const entries = buildMorphEntries(gA, gB, loopOf(gA), loopOf(gB));

        const N = 64;
        const wind = entries.map(() => 0);
        const { drawn: drawn0 } = resolveMorphAt(entries, 0);
        const prev = entries.map((_, i) => {
            const c = meanDir(drawn0[i] ?? []);
            return atan2(c[1], c[0]);
        });
        for (let k = 1; k <= N; k++) {
            const { drawn } = resolveMorphAt(entries, k / N);
            for (let i = 0; i < entries.length; i++) {
                if (drawn[i] === undefined || drawn[i].length === 0) { continue; }
                const c = meanDir(drawn[i]);
                if (hypot(c[0], c[1]) < 1e-6) { continue; }
                const a = atan2(c[1], c[0]);
                let d = a - prev[i];
                while (d > π) { d -= 2*π; }
                while (d < -π) { d += 2*π; }
                wind[i] += d;
                prev[i] = a;
            }
        }

        // collapsed topo entries wind noisily about their point-collapse
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].collapsed !== undefined) { continue; }
            expect(Math.abs(wind[i])).toBeLessThan(1.5*π);
        }
    });
});
