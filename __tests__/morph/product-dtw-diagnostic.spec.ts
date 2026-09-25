// Product-graph DTW diagnostic: can FREE segment-level routing find better
// (shape-wise) trunk correspondences than the current reroute machinery?
// Score-only - compares against matchPaths' chosen trunk pair.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import type { FatBranch } from '../../src/morph/fat-branch/fat-branch.js';
import type { MatchedPath } from '../../src/morph/match-paths/matched-path.js';
import { getFatBranchTree, getSkeletonBeziers } from '../../src/morph/fat-branch/get-fat-branch-tree.js';
import { getFattestCpNode } from '../../src/morph/fat-branch/get-fattest-cp-node.js';
import { matchPaths, defaultPathWeights } from '../../src/morph/match-paths/match-paths.js';
import { segGraphOf } from '../../src/morph/segment-graph/segment-graph.js';
import { sampleSegGraph } from '../../src/morph/segment-graph/sample-seg-graph.js';
import { productDtw } from '../../src/morph/segment-graph/product-dtw.js';
import { matchSegGraphs } from '../../src/morph/segment-graph/match-seg-graphs.js';
import { buildMorphEntries } from '../../src/morph/build-morph-entries/build-morph-entries.js';
import { resolveMorphAt } from '../../src/morph/resolve-morph-at/resolve-morph-at.js';
import { boolean, getShapeArea } from 'flo-boolean';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { sqrt } = Math;

const options: MatOptions = {
    applySat: false,
    simplify: false,
    satScale: 1.5,
    maxCurviness: 0.25,
    maxLength: 40,  // mirror the app
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

const TARGET_SAMPLES = 200;

function loadTree(glyphName: string): FatBranch {
    return loadGlyph(glyphName).tree;
}

function loadGlyph(glyphName: string): {
        tree: FatBranch; loops: number[][][][] } {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const loops = getPathsFromStr(d);
    const mats = findMats(loops, options);
    return {
        tree: getFatBranchTree(getFattestCpNode(mats[0].cpNode))!,
        loops
    };
}

function shapeArea(loops: number[][][][]): number {
    return Math.abs(loops.reduce((s, l) => s + getShapeArea(l), 0));
}

function union(outlines: number[][][][]): number[][][][] {
    const debugSave = (globalThis as any)._debug_;
    (globalThis as any)._debug_ = undefined;
    // drop degenerate (near-zero-area) loops - they break flo-boolean
    const solid = outlines.filter(l => Math.abs(getShapeArea(l)) > 1);
    try {
        return boolean('OR', solid);
    } finally {
        (globalThis as any)._debug_ = debugSave;
    }
}

function fmtPieces(mp: MatchedPath): string {
    const fmt = (ps: typeof mp.piecesA) => ps.map(p =>
        `[${p.fromEdge}..${p.toEdge})${p.reversed ? 'ʳ' : ''}`).join(' > ');
    return `A: ${fmt(mp.piecesA)}  B: ${fmt(mp.piecesB)}`;
}

function comparePair(nameA: string, nameB: string) {
    const tA = loadTree(nameA);
    const tB = loadTree(nameB);

    const t0 = performance.now();
    const pm = matchPaths(tA, tB);
    const t1 = performance.now();

    const gA = segGraphOf(tA);
    const gB = segGraphOf(tB);
    const sA = sampleSegGraph(gA, sqrt(tA.roundSalience), TARGET_SAMPLES);
    const sB = sampleSegGraph(gB, sqrt(tB.roundSalience), TARGET_SAMPLES);
    const t2 = performance.now();
    const pd = productDtw(sA, sB, defaultPathWeights);
    const t3 = performance.now();

    const fmtLeaf = (g: ReturnType<typeof segGraphOf>, v: number) => {
        const p = g.vertices[v].p;
        return `#${v}(${p[0].toFixed(0)},${p[1].toFixed(0)})`;
    };

    console.log(
        `=== ${nameA} → ${nameB} ===\n` +
        `matcher : shapeCost ${pm.trunk.cost.shapeCost.toFixed(4)} ` +
        `(total ${pm.trunk.cost.totalCost.toFixed(4)}, flipped ${pm.flipped}) ` +
        `[${(t1 - t0).toFixed(0)}ms]\n` +
        `  route ${fmtPieces(pm.trunk)}\n` +
        `product : shape ${pd.shapeCost.toFixed(4)} total ${
        pd.totalCost.toFixed(4)} covered ${(100*pd.covered).toFixed(1)}% ` +
        `(${pd.states} states, ${gA.segments.length}/${gB.segments.length} segs) ` +
        `[${(t3 - t2).toFixed(0)}ms]\n` +
        `  route A ${fmtLeaf(gA, pd.startA)}→${fmtLeaf(gA, pd.endA)} ` +
        `B ${fmtLeaf(gB, pd.startB)}→${fmtLeaf(gB, pd.endB)}`);

    return { pm, pd };
}


describe('product-graph DTW vs current matcher (score-only)', () => {

    test('identity sanity: v → v routes onto itself at ~zero cost', () => {
        const { pd } = comparePair('v', 'v');
        expect(pd.shapeCost).toBeLessThan(0.05);
    }, 120_000);

    test('v → Q_V', () => {
        const { pd } = comparePair('v', 'Q_V');
        expect(Number.isFinite(pd.totalCost)).toBe(true);
    }, 120_000);

    test('parenleft → parenright', () => {
        const { pd } = comparePair('parenleft', 'parenright');
        expect(Number.isFinite(pd.totalCost)).toBe(true);
    }, 120_000);

    test('hierarchical: v → Q_V children match too', () => {
        const tA = loadTree('v');
        const tB = loadTree('Q_V');
        const t0 = performance.now();
        const r = matchSegGraphs(
            segGraphOf(tA), segGraphOf(tB),
            sqrt(tA.roundSalience), sqrt(tB.roundSalience),
            defaultPathWeights);
        const t1 = performance.now();
        const stats = countOps(r.root);
        console.log(
            `hierarchical v→Q_V: ${stats.pairs} route pairs, ` +
            `${stats.dels} del / ${stats.inss} ins subtrees, ` +
            `cost ${r.cost.toFixed(4)}, ${(t1 - t0).toFixed(0)}ms`);
        expect(stats.pairs).toBeGreaterThan(0);
        expect(Number.isFinite(r.cost)).toBe(true);

        // identity: v → v matches every real subtree; only continuation
        // leftovers of rerouted sub-paths drop (the old matcher's stubs -
        // gated from matching), symmetrically on both sides
        const r2 = matchSegGraphs(
            segGraphOf(tA), segGraphOf(loadTree('v')),
            sqrt(tA.roundSalience), sqrt(tA.roundSalience),
            defaultPathWeights);
        const stats2 = countOps(r2.root);
        console.log(`hierarchical v→v: ${stats2.pairs} pairs, ` +
            `${stats2.dels} del (${stats2.edgeDels} edge-rooted) / ` +
            `${stats2.inss} ins (${stats2.edgeInss} edge-rooted), ` +
            `cost ${r2.cost.toFixed(4)}`);
        expect(stats2.edgeDels).toBe(0);
        expect(stats2.edgeInss).toBe(0);
        expect(stats2.dels).toBe(stats2.inss);
    }, 120_000);

    test('end-to-end: morph entries via the segment matcher tile the ' +
            'glyphs at t=0/t=1', () => {
        for (const [nA, nB] of [
                ['v', 'Q_V'], ['parenleft', 'parenright'],
                // regression: fork-terminated trunk + matched terminal =>
                // one branch covered by TWO entries (glue must pick right)
                ['an_one', 'aq_J']] as const) {
            const { tree: tA, loops: loopsA } = loadGlyph(nA);
            const { tree: tB, loops: loopsB } = loadGlyph(nB);

            const entries = buildMorphEntries(tA, tB);
            const trueA = shapeArea(loopsA);
            const trueB = shapeArea(loopsB);
            const a0 = shapeArea(union(resolveMorphAt(entries, 0).outlines));
            const a1 = shapeArea(union(resolveMorphAt(entries, 1).outlines));
            console.log(`${nA}→${nB}: t=0 ${(100*a0/trueA - 100).toFixed(1)}% ` +
                `t=1 ${(100*a1/trueB - 100).toFixed(1)}%`);

            expect(Math.abs(a0/trueA - 1)).toBeLessThan(0.10);
            expect(Math.abs(a1/trueB - 1)).toBeLessThan(0.10);
        }
    }, 240_000);
    test('every branch is drawn at t=0 even when drops are free ' +
            '(delFloor 0)', () => {
        // regression: trunk crossing a branch between interior forks left
        // both remainders unplaced (children glued 90 units away)
        const { tree: tA } = loadGlyph('v');
        const { tree: tB } = loadGlyph('Q_V');
        const entries = buildMorphEntries(tA, tB, [], { delFloor: 0 });
        const pts: number[][] = resolveMorphAt(entries, 0).drawn.flat(2);

        const missing: string[] = [];
        (function walk(br: FatBranch): void {
            const tip = getSkeletonBeziers(br)[0][0];
            let best = Infinity;
            for (const p of pts) {
                const d = Math.hypot(p[0] - tip[0], p[1] - tip[1]);
                if (d < best) { best = d; }
            }
            if (best > 3) {
                missing.push(`(${tip[0].toFixed(0)},${tip[1].toFixed(0)}) ` +
                    `dist ${best.toFixed(1)}`);
            }
            for (const e of br.children) { walk(e.branch); }
        })(tA);

        expect(missing).toEqual([]);
    }, 120_000);
});


function countOps(pair: import(
        '../../src/morph/segment-graph/match-seg-graphs.js').SegMatchedPair):
        { pairs: number; dels: number; inss: number;
          edgeDels: number; edgeInss: number } {
    let pairs = 1;
    let dels = 0;
    let inss = 0;
    let edgeDels = 0;
    let edgeInss = 0;
    for (const op of pair.ops) {
        if (op.type === 'match') {
            const s = countOps(op.sub);
            pairs += s.pairs;
            dels += s.dels;
            inss += s.inss;
            edgeDels += s.edgeDels;
            edgeInss += s.edgeInss;
        } else if (op.type === 'delete') {
            dels++;
            if (op.a.edge !== undefined) { edgeDels++; }
        } else {
            inss++;
            if (op.b.edge !== undefined) { edgeInss++; }
        }
    }
    return { pairs, dels, inss, edgeDels, edgeInss };
}
