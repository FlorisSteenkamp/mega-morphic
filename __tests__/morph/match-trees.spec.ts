import { expect, test, describe, beforeAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, fromStringifyable, getLargestVertex, getPathsFromStr, MatOptions } from 'flo-mat';
import { getBranchTree, type BranchTree } from '../../src/morph/branch-tree/get-branch-tree.js';
import { matchTrees } from '../../src/morph/match-trees/match-trees.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';


function loadTree(file: string): BranchTree {
    const json = JSON.parse(readFileSync(resolve('src/page/log', file), 'utf-8'));
    return getBranchTree(fromStringifyable(json));
}

function countNodes(tree: BranchTree): number {
    return 1 + tree.children.reduce((s, c) => s + countNodes(c), 0);
}


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
async function loadPathStr(glyphName: string) {
    const path = resolve('fonts-test/achispado.svg');
    const font = fontCache ??= parseSvgFont(readFileSync(path, 'utf-8'));
    const pathStr = font.find(glyph => glyph.name === glyphName)!.d;

    return pathStr;
}


async function loadTreeFromSvg(glyphName: string) {
    const pathStr = await loadPathStr(glyphName);
    const bezierLoops = getPathsFromStr(pathStr);
    const mats = findMats(bezierLoops, options);
    const cpNode = getLargestVertex(mats[0].cpNode);
    const tree = getBranchTree(cpNode);

    return { bezierLoops, mats, tree };
}


describe('matchTrees', function() {
    let tree1: BranchTree;
    let tree2: BranchTree;

    beforeAll(async function() {
        tree1 = (await loadTreeFromSvg('Mt3')).tree;
        // tree2 = (await loadTreeFromSvg('Mu3')).tree;
        tree2 = (await loadTreeFromSvg('exclam')).tree;
    });

    test('a tree matches itself exactly (zero cost, all matched)', function() {
        const { pairs, deleted, inserted, cost } = matchTrees(tree1, tree1);

        expect(cost).toBe(0);
        expect(deleted).toHaveLength(0);
        expect(inserted).toHaveLength(0);
        expect(pairs).toHaveLength(countNodes(tree1));
    });

    test('matching two different trees conserves every branch', function() {
        const { pairs, deleted, inserted, cost } = matchTrees(tree1, tree2);

        // Every branch of each tree is either matched or unmatched, exactly once.
        expect(pairs.length + deleted.length).toBe(countNodes(tree1));
        expect(pairs.length + inserted.length).toBe(countNodes(tree2));

        expect(cost).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(cost)).toBe(true);
    });

    test('matching is symmetric in cost', function() {
        const cost12 = matchTrees(tree1, tree2).cost;
        const cost21 = matchTrees(tree2, tree1).cost;

        expect(cost21).toBeNearly([2], cost12);
    });
});
