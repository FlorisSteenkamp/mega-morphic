// TEMP diagnostic (delete after debugging): what geometry sits at the
// big-kink joints of the morphed outline at t=0.5?
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import { segTreeWithLoop, loopOf } from '../helpers/seg-tree-with-loop.js';
import { buildMorphEntries } from '../../src/morph/build-morph-entries/build-morph-entries.js';
import { resolveMorphAt } from '../../src/morph/resolve-morph-at/resolve-morph-at.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { atan2, hypot, abs, PI: π } = Math;

const options: MatOptions = {
    applySat: false, simplify: false, satScale: 1.5, maxCurviness: 0.25,
    maxLength: 40, angleIncrement: 15, simplifyTolerance: 2**-5
};

function loadGraph(glyphName: string) {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const mats = findMats(getPathsFromStr(d), options);
    return segTreeWithLoop(mats[0].cpNode);
}

function dirAtStart(ps: number[][]): number[] {
    for (let i = 1; i < ps.length; i++) {
        const d = [ps[i][0] - ps[0][0], ps[i][1] - ps[0][1]];
        if (d[0] !== 0 || d[1] !== 0) { return d; }
    }
    return [0, 0];
}
function dirAtEnd(ps: number[][]): number[] {
    const pE = ps[ps.length - 1];
    for (let i = ps.length - 2; i >= 0; i--) {
        const d = [pE[0] - ps[i][0], pE[1] - ps[i][1]];
        if (d[0] !== 0 || d[1] !== 0) { return d; }
    }
    return [0, 0];
}
function len(ps: number[][]): number {
    let L = 0;
    for (let i = 1; i < ps.length; i++) {
        L += hypot(ps[i][0] - ps[i-1][0], ps[i][1] - ps[i-1][1]);
    }
    return L;
}

describe('TEMP kink anatomy', () => {
    test('positional wobble + short-way θ flips', () => {
        const tA = loadGraph('v');
        const tB = loadGraph('Q_V');
        const entries = buildMorphEntries(tA, tB, loopOf(tA), loopOf(tB));

        // zigzag amplitude: deviation of each piece-joint from the local
        // chord of its neighbors, on the largest loop
        for (const t of [0, 0.25, 0.5]) {
            const { outlines } = resolveMorphAt(entries, t);
            const loop = outlines.reduce((a, b) =>
                lenLoop(b) > lenLoop(a) ? b : a);
            const joints = loop.map(ps => ps[0]);
            let sum = 0;
            let mx = 0;
            let n = 0;
            for (let i = 1; i + 1 < joints.length; i++) {
                const [a, b, c] = [joints[i-1], joints[i], joints[i+1]];
                const ux = c[0] - a[0];
                const uy = c[1] - a[1];
                const L = hypot(ux, uy);
                if (L < 1) { continue; }
                // perpendicular distance of b from chord a-c
                const d = abs(ux*(b[1]-a[1]) - uy*(b[0]-a[0])) / L;
                sum += d; n++; if (d > mx) { mx = d; }
            }
            console.log(`t=${t}: zigzag mean ${(sum/n).toFixed(4)} ` +
                `max ${mx.toFixed(3)} over ${n} joints`);
        }

        // short-way θ flips along entry 0's sleeves
        const e0 = entries[0];
        for (const [name, side] of [
                ['out', e0.sleeveOut], ['back', e0.sleeveBack]] as const) {
            if (side === undefined) { continue; }
            const dθs: number[] = [];
            for (let k = 0; k < side.anchorsA.length; k++) {
                const dθ = wrap(side.anchorsB[k][0] - side.anchorsA[k][0]);
                dθs.push(dθ);
            }
            let flips = 0;
            for (let k = 1; k < dθs.length; k++) {
                if (abs(dθs[k]) > 2 && abs(dθs[k-1]) > 2 &&
                    Math.sign(dθs[k]) !== Math.sign(dθs[k-1])) { flips++; }
            }
            const big = dθs.filter(d => abs(d) > 2).length;
            console.log(`sleeve ${name}: ${dθs.length} anchors, ` +
                `|dθ|>2rad: ${big}, adjacent sign-flips: ${flips}`);
        }
        expect(true).toBe(true);
    }, 120_000);

    function wrap(x: number): number {
        return ((x + π) % (2*π) + 2*π) % (2*π) - π;
    }
    function lenLoop(loop: number[][][]): number {
        let L = 0;
        for (const ps of loop) { L += len(ps); }
        return L;
    }

    test('what pieces meet at the big kinks (t=0.5)', () => {
        const tA = loadGraph('v');
        const tB = loadGraph('Q_V');
        const entries = buildMorphEntries(tA, tB, loopOf(tA), loopOf(tB));

        for (const t of [0, 0.5]) {
            const { outlines } = resolveMorphAt(entries, t);
            const report: { kink: number; desc: string }[] = [];
            for (let li = 0; li < outlines.length; li++) {
                const loop = outlines[li];
                for (let i = 0; i < loop.length; i++) {
                    const prev = loop[i];
                    const next = loop[(i + 1) % loop.length];
                    const dO = dirAtEnd(prev);
                    const dI = dirAtStart(next);
                    if ((dO[0] === 0 && dO[1] === 0) ||
                        (dI[0] === 0 && dI[1] === 0)) { continue; }
                    const kink = abs(atan2(
                        dO[0]*dI[1] - dO[1]*dI[0],
                        dO[0]*dI[0] + dO[1]*dI[1])) * 180/π;
                    // only VISIBLE kinks: both pieces substantial
                    if (kink > 3 && len(prev) > 1 && len(next) > 1) {
                        report.push({
                            kink,
                            desc: `loop${li}@${i}: prev n=${prev.length} ` +
                                `L=${len(prev).toFixed(2)} | next ` +
                                `n=${next.length} L=${len(next).toFixed(2)}`
                        });
                    }
                }
            }
            report.sort((x, y) => y.kink - x.kink);
            console.log(`t=${t}: ${report.length} kinks > 3°`);
            for (const r of report.slice(0, 15)) {
                console.log(`  ${r.kink.toFixed(1)}° ${r.desc}`);
            }
        }
        expect(true).toBe(true);
    }, 120_000);
});
