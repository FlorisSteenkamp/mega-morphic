// Sway tie-break regression: hyphen-2's trunk orientation is a near-tie
// (symmetric bar) - without the anisotropy-scaled sway term the matcher
// may pick the reversed route and the whole morph rotates ~180°.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import type { SegGraph } from '../../src/morph/segment-graph/seg-graph.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { segGraphFromMat } from '../../src/morph/segment-graph/seg-graph-from-mat.js';
import { matchSegGraphs, composeRoute } from '../../src/morph/segment-graph/match-seg-graphs.js';
import type { RouteStep } from '../../src/morph/segment-graph/match-seg-graphs.js';
import { procrustes } from '../../src/morph/procrustes/procrustes-analysis.js';
import { unwrappedChordAngles } from '../../src/morph/intrinsic-skeleton/unwrapped-chord-angles.js';
import { wrapAngle } from '../../src/morph/intrinsic-skeleton/wrap-angle.js';
import { totalLength$ } from '../../src/morph/fs/total-length.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { sqrt, abs, PI: π } = Math;

const options: MatOptions = {
    applySat: false,
    simplify: false,
    satScale: 1.5,
    maxCurviness: 0.25,
    maxLength: 40,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

let SAT = false;

function loadGraph(glyphName: string): SegGraph {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const mats = findMats(getPathsFromStr(d), { ...options, applySat: SAT });
    return segGraphFromMat(mats[0].cpNode);
}

function meanAngleOf(route: RouteStep[]): number {
    const bz = composeRoute(route).skelPss;
    const ψs = unwrappedChordAngles(bz);
    let s = 0, total = 0;
    for (let i = 0; i < bz.length; i++) {
        const l = totalLength$(bz[i]);
        s += ψs[i]*l; total += l;
    }
    return total === 0 ? 0 : s/total;
}

function swing(nameA: string, nameB: string, aniso: number): number {
    const gA = loadGraph(nameA);
    const gB = loadGraph(nameB);
    const r = matchSegGraphs(
        gA, gB, gA.unit, gB.unit,
        defaultPathWeights, aniso);
    return abs(wrapAngle(
        meanAngleOf(r.root.routeB) - meanAngleOf(r.root.routeA)));
}

describe('sway orientation tie-break', () => {
    test('hyphen/hyphen-2 does not rotate with sway active', () => {
        for (const sat of [false, true]) {
            SAT = sat;
            for (const [a, b] of [
                    ['hyphen', 'hyphen-2'], ['hyphen-2', 'hyphen']] as const) {
                const gA = loadGraph(a);
                const gB = loadGraph(b);
                const aniso = (procrustes(gA.loop).anisotropy +
                    procrustes(gB.loop).anisotropy) / 2;

                const withSway = swing(a, b, aniso);
                const noSway = swing(a, b, 0);
                console.log(`${a} → ${b} (SAT ${sat}, aniso ${
                    aniso.toFixed(3)}): swing sway ON ${
                    (withSway/π*180).toFixed(1)}°  OFF ${
                    (noSway/π*180).toFixed(1)}°`);

                expect(withSway).toBeLessThan(π/2);
            }
        }
    }, 300_000);
});
