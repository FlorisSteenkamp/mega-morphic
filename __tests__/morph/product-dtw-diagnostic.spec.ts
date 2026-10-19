// Product-graph DTW diagnostic: scores + routes of the segment matcher's
// free segment-level routing (score-only trunk DTW + hierarchical match).
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import type { Segment } from '../../src/morph/segment-tree/segment.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { segTreeWithLoop, loopOf } from '../helpers/seg-tree-with-loop.js';
import type { Circle } from 'flo-mat';
import { vertexIds$ } from '../../src/debug/segment-tree/vertex-ids.js';
import { geomOf$ } from '../../src/morph/segment-tree/geom-of.js';
import { getUnit$ } from '../../src/morph/segment-tree/get-unit.js';
import { sampleSegTree } from '../../src/morph/segment-tree/sample-seg-tree.js';
import { productDtw } from '../../src/morph/segment-tree/product-dtw.js';
import { matchSegTrees } from '../../src/morph/segment-tree/match-seg-trees/match-seg-trees.js';
import { buildMorphEntries } from '../../src/morph/build-morph-entries/build-morph-entries.js';
import { resolveMorphAt } from '../../src/morph/resolve-morph-at/resolve-morph-at.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { sqrt, abs, max, min, hypot } = Math;

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

function loadGraph(glyphName: string): Segment[] {
    return loadGlyph(glyphName).g;
}

function loadGlyph(glyphName: string): {
        g: Segment[]; loops: number[][][][] } {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const loops = getPathsFromStr(d);
    const mats = findMats(loops, options);
    return {
        g: segTreeWithLoop(mats[0].cpNode),
        loops
    };
}

function evalBezier(ps: number[][], t: number): number[] {
    let q = ps;
    while (q.length > 1) {
        const next: number[][] = [];
        for (let i = 0; i + 1 < q.length; i++) {
            next.push([
                q[i][0]*(1 - t) + q[i + 1][0]*t,
                q[i][1]*(1 - t) + q[i + 1][1]*t
            ]);
        }
        q = next;
    }
    return q[0];
}

function polygonize(loop: number[][][], perCurve = 8): number[][] {
    const out: number[][] = [];
    for (const ps of loop) {
        for (let i = 0; i < perCurve; i++) {
            out.push(evalBezier(ps, i / perCurve));
        }
    }
    return out;
}

/** Even-odd containment over all loops (counters subtract). */
function insideLoops(p: number[], polys: number[][][]): boolean {
    let inside = false;
    for (const poly of polys) {
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi, yi] = poly[i];
            const [xj, yj] = poly[j];
            if ((yi > p[1]) !== (yj > p[1]) &&
                p[0] < (xj - xi)*(p[1] - yi)/(yj - yi) + xi) {
                inside = !inside;
            }
        }
    }
    return inside;
}

function distToPolys(p: number[], polys: number[][][]): number {
    let d = Infinity;
    for (const poly of polys) {
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[j];
            const b = poly[i];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const L2 = dx*dx + dy*dy;
            const t = L2 === 0 ? 0 : max(0, min(1,
                ((p[0] - a[0])*dx + (p[1] - a[1])*dy)/L2));
            d = min(d, hypot(p[0] - (a[0] + t*dx), p[1] - (a[1] + t*dy)));
        }
    }
    return d;
}

/** Sampled containment of the entry outlines vs the true glyph: max
 *  outside distance of outline samples (spill) + uncovered safely-interior
 *  grid points (holes). */
function containment(
        outlines: number[][][][],
        glyphLoops: number[][][][]): {
        maxOutside: number; holes: number; tested: number } {

    const glyphPolys = glyphLoops.map(l => polygonize(l, 16));
    const outlinePolys = outlines.map(l => polygonize(l));

    let maxOutside = 0;
    for (const poly of outlinePolys) {
        for (const p of poly) {
            if (!insideLoops(p, glyphPolys)) {
                maxOutside = max(maxOutside, distToPolys(p, glyphPolys));
            }
        }
    }

    const all = glyphPolys.flat();
    const xs = all.map(p => p[0]);
    const ys = all.map(p => p[1]);
    const [x0, x1] = [min(...xs), max(...xs)];
    const [y0, y1] = [min(...ys), max(...ys)];
    let holes = 0;
    let tested = 0;
    const N = 40;
    for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
            const p = [x0 + (x1 - x0)*i/N, y0 + (y1 - y0)*j/N];
            if (!insideLoops(p, glyphPolys) ||
                distToPolys(p, glyphPolys) < 3) { continue; }
            tested++;
            if (!outlinePolys.some(poly => insideLoops(p, [poly]))) {
                holes++;
            }
        }
    }

    return { maxOutside, holes, tested };
}

function comparePair(nameA: string, nameB: string) {
    const gA = loadGraph(nameA);
    const gB = loadGraph(nameB);

    const sA = sampleSegTree(gA, getUnit$(loopOf(gA)), TARGET_SAMPLES, undefined);
    const sB = sampleSegTree(gB, getUnit$(loopOf(gB)), TARGET_SAMPLES, undefined);
    const t2 = performance.now();
    const pd = productDtw(sA, sB, defaultPathWeights);
    const t3 = performance.now();

    const fmtLeaf = (g: Segment[], v: Circle) => {
        const p = v.center;
        return `#${vertexIds$(g).get(v)}(${p[0].toFixed(0)},${p[1].toFixed(0)})`;
    };

    console.log(
        `=== ${nameA} → ${nameB} ===\n` +
        `product : shape ${pd.shapeCost.toFixed(4)} total ${
        pd.totalCost.toFixed(4)} covered ${(100*pd.covered).toFixed(1)}% ` +
        `(${pd.states} states, ${gA.length}/${gB.length} segs) ` +
        `[${(t3 - t2).toFixed(0)}ms]\n` +
        `  route A ${fmtLeaf(gA, pd.startA)}→${fmtLeaf(gA, pd.endA)} ` +
        `B ${fmtLeaf(gB, pd.startB)}→${fmtLeaf(gB, pd.endB)}`);

    return { pd };
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
        const gA = loadGraph('v');
        const gB = loadGraph('Q_V');
        const t0 = performance.now();
        const r = matchSegTrees(
            gA, gB, loopOf(gA), loopOf(gB), defaultPathWeights);
        const t1 = performance.now();
        const stats = countOps(r);
        console.log(
            `hierarchical v→Q_V: ${stats.pairs} route pairs, ` +
            `${stats.dels} del / ${stats.inss} ins subtrees, ` +
            `cost ${r.cost.toFixed(4)}, ${(t1 - t0).toFixed(0)}ms`);
        expect(stats.pairs).toBeGreaterThan(0);
        expect(Number.isFinite(r.cost)).toBe(true);

        // identity: v → v matches every real subtree; only leftover
        // subtrees of rerouted sub-paths drop, symmetrically on both sides
        const gA2 = loadGraph('v');
        const gB2 = loadGraph('v');
        const r2 = matchSegTrees(
            gA2, gB2, loopOf(gA2), loopOf(gB2), defaultPathWeights);
        const stats2 = countOps(r2);
        console.log(`hierarchical v→v: ${stats2.pairs} pairs, ` +
            `${stats2.dels} del / ${stats2.inss} ins, ` +
            `cost ${r2.cost.toFixed(4)}`);
        expect(stats2.dels).toBe(stats2.inss);
    }, 120_000);

    test('end-to-end: morph entries via the segment matcher tile the ' +
            'glyphs at t=0/t=1', () => {
        for (const [nA, nB] of [
                ['v', 'Q_V'], ['parenleft', 'parenright'],
                // regression: fork-terminated trunk + matched terminal =>
                // one branch covered by TWO entries (glue must pick right)
                ['an_one', 'aq_J']] as const) {
            const { g: gA, loops: loopsA } = loadGlyph(nA);
            const { g: gB, loops: loopsB } = loadGlyph(nB);

            const entries = buildMorphEntries(gA, gB, loopOf(gA), loopOf(gB));
            // Union SIGNED area double-counts coincident per-segment seams
            // at the endpoints (documented flo-boolean degeneracy) - use
            // sampled containment instead: no spill, no interior holes.
            const c0 = containment(
                resolveMorphAt(entries, 0).outlines, loopsA);
            const c1 = containment(
                resolveMorphAt(entries, 1).outlines, loopsB);
            console.log(`${nA}→${nB}: t=0 spill ${c0.maxOutside.toFixed(2)} ` +
                `holes ${c0.holes}/${c0.tested} | t=1 spill ${
                c1.maxOutside.toFixed(2)} holes ${c1.holes}/${c1.tested}`);

            expect(c0.maxOutside).toBeLessThan(0.5);
            expect(c0.holes).toBe(0);
            expect(c1.maxOutside).toBeLessThan(0.5);
            expect(c1.holes).toBe(0);
        }
    }, 240_000);
    test('every segment is drawn at t=0 even when drops are free ' +
            '(delFloor 0)', () => {
        // regression: trunk crossing between interior forks left
        // remainders unplaced (children glued 90 units away)
        const gA = loadGraph('v');
        const gB = loadGraph('Q_V');
        const entries = buildMorphEntries(gA, gB, loopOf(gA), loopOf(gB), { delFloor: 0 });
        const pts: number[][] = resolveMorphAt(entries, 0).drawn.flat(2);

        const missing: string[] = [];
        for (const seg of gA) {
            const tip = geomOf$(seg).skelPss[0][0];
            let best = Infinity;
            for (const p of pts) {
                const d = Math.hypot(p[0] - tip[0], p[1] - tip[1]);
                if (d < best) { best = d; }
            }
            if (best > 3) {
                missing.push(`(${tip[0].toFixed(0)},${tip[1].toFixed(0)}) ` +
                    `dist ${best.toFixed(1)}`);
            }
        }

        expect(missing).toEqual([]);
    }, 120_000);
});


function countOps(pair: import(
        '../../src/morph/segment-tree/match-seg-trees/seg-matched-pair.js').SegMatchedPair):
        { pairs: number; dels: number; inss: number } {
    let pairs = 1;
    let dels = 0;
    let inss = 0;
    for (const op of pair.ops) {
        if (op.type === 'match') {
            const s = countOps(op.sub);
            pairs += s.pairs;
            dels += s.dels;
            inss += s.inss;
        } else if (op.type === 'delete') {
            dels++;
        } else {
            inss++;
        }
    }
    return { pairs, dels, inss };
}
