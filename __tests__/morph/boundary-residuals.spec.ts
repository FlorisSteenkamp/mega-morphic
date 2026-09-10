import { describe, test, beforeAll, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, getBoundaryBeziersToNext, MatOptions } from 'flo-mat';
import type { FatBranch } from '../../src/morph/fat-branch.js';
import {
    getFatBranchTree, getSkeletonBeziers, getSkeletonRadii,
    getSkeletonEdgeCpPairs
} from '../../src/morph/get-fat-branch-tree.js';
import {
    getResidualSamples, reconstructBoundarySides
} from '../../src/morph/boundary-residuals.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';


const options: MatOptions = {
    applySat: false,
    simplify: false,
    satScale: 1.5,
    maxCurviness: 0.25,
    maxLength: 40,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

function loadTree(glyphName: string): FatBranch {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const mats = findMats(getPathsFromStr(d), options);
    return getFatBranchTree(mats[0].cpNode)!;
}

function allBranches(tree: FatBranch): FatBranch[] {
    const out: FatBranch[] = [tree];
    const walk = (fb: FatBranch) => {
        for (const edge of fb.children ?? []) {
            out.push(edge.branch);
            walk(edge.branch);
        }
    };
    walk(tree);
    return out;
}


describe('boundary residuals (step 6a)', () => {
    let tree: FatBranch;

    beforeAll(() => {
        tree = loadTree('parenleft');
    });

    test('every skeleton edge has both boundary sides', () => {
        for (const fb of allBranches(tree)) {
            for (const pair of getSkeletonEdgeCpPairs(fb)) {
                expect(pair.out).toBeDefined();
                expect(pair.back).toBeDefined();
                expect(getBoundaryBeziersToNext(pair.out).length)
                    .toBeGreaterThan(0);
            }
        }
    });

    test('reconstruction at t=0 reproduces the true boundary exactly', () => {
        for (const fb of allBranches(tree)) {
            const samples = getResidualSamples(fb);
            const { out, back } = reconstructBoundarySides(
                getSkeletonBeziers(fb), getSkeletonRadii(fb), samples
            );

            expect(out.length).toBe(samples.length);
            expect(back.length).toBe(samples.length);

            // Recompute the truth points the same way the sampler did and
            // compare against the reconstruction (must agree to fp noise).
            const pairs = getSkeletonEdgeCpPairs(fb);
            let i = 0;
            for (const smp of samples) {
                const { out: cpOut, back: cpBack } = pairs[smp.edge];
                const truthOut = sampleTruth(
                    getBoundaryBeziersToNext(cpOut), smp.f);
                const truthBack = sampleTruth(
                    getBoundaryBeziersToNext(cpBack), 1 - smp.f);

                expect(out[i][0]).toBeCloseTo(truthOut[0], 6);
                expect(out[i][1]).toBeCloseTo(truthOut[1], 6);
                expect(back[i][0]).toBeCloseTo(truthBack[0], 6);
                expect(back[i][1]).toBeCloseTo(truthBack[1], 6);
                i++;
            }
        }
    });

    test('residual magnitudes are small relative to the disk radii', () => {
        // Envelope model error should be a modest fraction of the local
        // radius - a sanity bound, not a tight one.
        const fb = tree;
        const radii = getSkeletonRadii(fb);
        const maxR = Math.max(...radii);
        for (const smp of getResidualSamples(fb)) {
            for (const side of [smp.out, smp.back]) {
                const mag = Math.hypot(side.rT, side.rN);
                expect(mag).toBeLessThan(maxR);
            }
        }
    });
});


import { evalDeCasteljau, getTAtLength, length } from 'flo-bezier3';

function sampleTruth(pss: number[][][], f: number): number[] {
    const lengths = pss.map(ps => length([0, 1], ps));
    const total = lengths.reduce((s, l) => s + l, 0);
    if (total === 0) { return pss[0][0]; }

    let s = f * total;
    let i = 0;
    while (i < pss.length - 1 && s > lengths[i]) { s -= lengths[i]; i++; }

    const t = Math.max(0, Math.min(1, getTAtLength(pss[i], s)));
    return evalDeCasteljau(pss[i], t);
}
