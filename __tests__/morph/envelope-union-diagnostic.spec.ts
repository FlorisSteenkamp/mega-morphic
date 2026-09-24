// Diagnostic: replicate the full onMorphClicked → drawMorph envelope-union
// pipeline on real glyphs to find why the union draws nothing in the app.
import { describe, test, beforeAll, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import { boolean, getShapeArea, enableDebugForBooleanOp } from 'flo-boolean';
import type { FatBranch } from '../../src/morph/fat-branch/fat-branch.js';
import { buildMorphEntries } from '../../src/morph/build-morph-entries/build-morph-entries.js';
import { resolveMorphAt } from '../../src/morph/resolve-morph-at.js';
import { getFatBranchTree } from '../../src/morph/fat-branch/get-fat-branch-tree.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';


const options: MatOptions = {
    applySat: false,
    simplify: false,
    satScale: 1.5,
    maxCurviness: 0.25,
    maxLength: 100,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

function loadGlyph(glyphName: string) {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const loops = getPathsFromStr(d);
    const mats = findMats(loops, options);
    return { tree: getFatBranchTree(mats[0].cpNode)!, loops };
}

const matchColors = [
    'pink', 'cyan', 'purple', 'orange', 'yellow', 'brown',
];

function shapeArea(loops: number[][][][]): number {
    return Math.abs(loops.reduce((s, l) => s + getShapeArea(l), 0));
}

/** Union of the resolved outlines (flo-boolean, `_debug_` masked). */
function union(outlines: number[][][][]): number[][][][] {
    const debugSave = (globalThis as any)._debug_;
    (globalThis as any)._debug_ = undefined;
    try {
        return boolean('OR', outlines);
    } finally {
        (globalThis as any)._debug_ = debugSave;
    }
}


describe('envelope union on real glyphs (exact app pipeline)', () => {
    let tree1: FatBranch;
    let tree2: FatBranch;
    let loops1: number[][][][];
    let loops2: number[][][][];

    beforeAll(() => {
        ({ tree: tree1, loops: loops1 } = loadGlyph('parenleft'));
        ({ tree: tree2, loops: loops2 } = loadGlyph('parenright'));
    });

    test('resolveMorphAt yields a nonempty union at several t', () => {
        const entries = buildMorphEntries(tree1, tree2);
        console.log(`${entries.length} entries`);

        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const start = performance.now();
            const outlineUnion = union(resolveMorphAt(entries, t).outlines);
            const ms = (performance.now() - start).toFixed(0);

            const area = shapeArea(outlineUnion);
            console.log(
                `t=${t}: ${outlineUnion.length} union loops in ${ms}ms, ` +
                `area ${area.toFixed(0)}`);

            expect(outlineUnion.length).toBeGreaterThan(0);
            expect(area).toBeGreaterThan(1000);
        }
    }, 120_000);

    test('reconstructed outline matches the true glyph areas at t=0/1', () => {
        const entries = buildMorphEntries(tree1, tree2);

        const area0 = shapeArea(union(resolveMorphAt(entries, 0).outlines));
        const area1 = shapeArea(union(resolveMorphAt(entries, 1).outlines));
        const true1 = shapeArea(loops1);
        const true2 = shapeArea(loops2);
        console.log(
            `t=0: ${area0.toFixed(0)} vs true ${true1.toFixed(0)}; ` +
            `t=1: ${area1.toFixed(0)} vs true ${true2.toFixed(0)}`);

        // Residual-corrected outline; tips are bare envelope cap arcs, so
        // a few-percent area gap remains.
        expect(Math.abs(area0 - true1) / true1).toBeLessThan(0.05);
        expect(Math.abs(area1 - true2) / true2).toBeLessThan(0.05);
    }, 120_000);

    test('same but with _debug_ enabled like the app', () => {
        // The app calls enableDebugForBooleanOp(true) - flo-boolean then uses
        // a DIFFERENT container size + debug branches inside boolean().
        (globalThis as any)._debug_ = {};
        enableDebugForBooleanOp(true);
        try {
            const entries = buildMorphEntries(tree1, tree2);

            for (const t of [0, 0.25, 0.5, 0.75, 1]) {
                const outlineUnion = union(resolveMorphAt(entries, t).outlines);
                const area = shapeArea(outlineUnion);
                console.log(
                    `DEBUG-ON t=${t}: ${outlineUnion.length} loops, ` +
                    `area ${area.toFixed(0)}`);

                expect(outlineUnion.length).toBeGreaterThan(0);
                expect(area).toBeGreaterThan(1000);
            }
        } finally {
            enableDebugForBooleanOp(false);
        }
    }, 120_000);
});
