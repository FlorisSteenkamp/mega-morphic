import { expect, test, describe, beforeAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getLargestVertex, getMatCurveToNext, getPathsFromStr, MatOptions, type CpNode } from 'flo-mat';
import { getBranchTree } from '../../src/morph/branch-tree/get-branch-tree.js';
import { distributeBeziersEvenly } from '../../src/morph/distribute-beziers-evenly.js';
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


interface Glyph {
    name: string;
    d: string;
}

let fontCache: Glyph[] = undefined!;  // Cache
function loadPathStr(glyphName: string) {
    const font = fontCache ??= parseSvgFont(readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));

    return font.find(glyph => glyph.name === glyphName)!.d;
}

function loadBranch(glyphName: string): CpNode[] {
    const mats = findMats(getPathsFromStr(loadPathStr(glyphName)), options);
    return getBranchTree(getLargestVertex(mats[0].cpNode)).branch;
}


describe('distributeBeziersEvenly', function() {
    let branch1: CpNode[];
    let branch2: CpNode[];

    beforeAll(function() {
        branch1 = loadBranch('Mt3');
        branch2 = loadBranch('Mu3');
    });

    test('produces equal-length, cubic, corresponding bezier arrays', function() {
        const [m1, m2] = distributeBeziersEvenly(branch1, branch2);

        expect(m1.beziers.length).toBeGreaterThan(0);
        expect(m1.beziers.length).toBe(m2.beziers.length);

        for (const beziers of [m1.beziers, m2.beziers]) {
            for (const ps of beziers) {
                expect(ps).toHaveLength(4);                 // cubic
                for (const p of ps) { expect(p).toHaveLength(2); }
            }
        }
    });

    test('the original cp-nodes are preserved on each MorphBranch', function() {
        const [m1, m2] = distributeBeziersEvenly(branch1, branch2);

        expect(m1.cpNodes).toBe(branch1);
        expect(m2.cpNodes).toBe(branch2);
    });

    test('segments are C0-continuous and span the original branch', function() {
        const [m1] = distributeBeziersEvenly(branch1, branch2);
        const { beziers } = m1;

        // Consecutive segments share an endpoint.
        for (let i = 0; i < beziers.length - 1; i++) {
            const end = beziers[i][3];
            const start = beziers[i + 1][0];
            expect(start[0]).toBeCloseTo(end[0], 6);
            expect(start[1]).toBeCloseTo(end[1], 6);
        }

        // The split covers exactly the original branch, endpoint to endpoint.
        const origStart = getMatCurveToNext(branch1[0])[0];
        const origEndCurve = getMatCurveToNext(branch1[branch1.length - 1]);
        const origEnd = origEndCurve[origEndCurve.length - 1];

        expect(beziers[0][0][0]).toBeCloseTo(origStart[0], 6);
        expect(beziers[0][0][1]).toBeCloseTo(origStart[1], 6);
        expect(beziers[beziers.length - 1][3][0]).toBeCloseTo(origEnd[0], 6);
        expect(beziers[beziers.length - 1][3][1]).toBeCloseTo(origEnd[1], 6);
    });
});
