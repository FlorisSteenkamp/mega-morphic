// Trunk-beam correspondence regression: hyphen-2 (flipped H+V) → hyphen.
// The DP is mirror-blind (symmetric shapes tie exactly), so the beam must
// rank by dp + sway and dedupe reversed twins - else the no-rotation
// pairing never reaches the recursion and a prong gets deleted + regrown.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import type { SegGraph } from '../../src/morph/segment-graph/seg-graph.js';
import type { SegOp } from '../../src/morph/segment-graph/match-seg-graphs.js';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { segGraphFromMat } from '../../src/morph/segment-graph/seg-graph-from-mat.js';
import { sampleSegGraph } from '../../src/morph/segment-graph/sample-seg-graph.js';
import { productDtw } from '../../src/morph/segment-graph/product-dtw.js';
import { matchSegGraphs } from '../../src/morph/segment-graph/match-seg-graphs.js';
import { calcProcrustes } from '../../src/morph/procrustes/calc-procrustes.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { sqrt } = Math;

function loadLoops(glyphName: string): number[][][][] {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    return getPathsFromStr(d);
}

/** point-reflect about the CP bbox center (flipH + flipV, as flipLoops) */
function flipBoth(loops: number[][][][]): number[][][][] {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const loop of loops) { for (const ps of loop) { for (const [x, y] of ps) {
        if (x < minX) { minX = x; } if (x > maxX) { maxX = x; }
        if (y < minY) { minY = y; } if (y > maxY) { maxY = y; }
    } } }
    const cx = (minX + maxX)/2;
    const cy = (minY + maxY)/2;
    return loops.map(loop => loop.map(ps =>
        ps.map(([x, y]) => [2*cx - x, 2*cy - y])));
}

function graphOf(loops: number[][][][], applySat: boolean): SegGraph {
    const options: MatOptions = {
        applySat,
        simplify: false,
        satScale: 1.5,
        maxCurviness: 0.25,
        maxLength: 40,
        angleIncrement: 15,
        simplifyTolerance: 2**-5
    };
    const mats = findMats(loops, options);
    return segGraphFromMat(mats[0].cpNode);
}

function vLabel(g: SegGraph, v: number): string {
    let deg = 0;
    for (const s of g.segments) { if (s.v0 === v || s.v1 === v) { deg++; } }
    const p = g.vertices[v].p;
    return `#${v}${deg === 1 ? 'leaf' : deg >= 3 ? 'FORK' : ''}` +
        `(${p[0].toFixed(0)},${p[1].toFixed(0)})`;
}

function opLine(op: SegOp): string {
    const c = (x: { dist: number; side: number; terminal?: string;
            material: number }) =>
        `d${x.dist.toFixed(0)} s${x.side}${x.terminal ? ' ' + x.terminal : ''}` +
        ` m${x.material.toFixed(3)}`;
    return op.type === 'match'
        ? `    match  A[${c(op.a)}] ↔ B[${c(op.b)}]`
        : op.type === 'delete'
        ? `    DELETE A[${c(op.a)}]`
        : `    INSERT B[${c(op.b)}]`;
}

function probe(applySat: boolean): { pairs: number; drops: number } {
    const loopsA = flipBoth(loadLoops('hyphen-2'));
    const loopsB = loadLoops('hyphen');
    const gA = graphOf(loopsA, applySat);
    const gB = graphOf(loopsB, applySat);
    const uA = gA.unit;
    const uB = gB.unit;
    const aniso = (calcProcrustes(gA.loop).anisotropy +
        calcProcrustes(gB.loop).anisotropy) / 2;

    const pd = productDtw(
        sampleSegGraph(gA, uA, 200), sampleSegGraph(gB, uB, 200),
        defaultPathWeights);

    console.log(`\n===== applySat ${applySat}: hyphen-2(flipped) → hyphen ` +
        `(aniso ${aniso.toFixed(3)}, ${gA.segments.length}/${
        gB.segments.length} segs) =====`);
    console.log(`-- DP beam (${pd.candidates.length} candidates):`);
    for (const c of pd.candidates) {
        console.log(`  dp ${c.totalCost.toFixed(4)}  ` +
            `A ${vLabel(gA, c.startA)}→${vLabel(gA, c.endA)}  ` +
            `B ${vLabel(gB, c.startB)}→${vLabel(gB, c.endB)}`);
    }

    const dbgSave = (globalThis as { _debug_?: unknown })._debug_;
    (globalThis as { _debug_?: unknown })._debug_ = {};
    try {
        const r = matchSegGraphs(gA, gB, uA, uB, defaultPathWeights, aniso);
        console.log(`-- re-rank leaders (${r.trunkCands!.length}):`);
        for (const tc of r.trunkCands!) {
            if (tc.sel === undefined) { continue; }  // not fully evaluated
            const chosen = tc.startA === r.trunkStartA &&
                tc.startB === r.trunkStartB ? '  << CHOSEN' : '';
            console.log(`  sel ${tc.sel.toFixed(4)} (rec ${
                tc.recCost!.toFixed(4)} + sway ${tc.sway.toFixed(4)}, dp ${
                tc.dpTotal.toFixed(4)}, cheap ${tc.cheap.toFixed(4)})  ` +
                `A ${vLabel(gA, tc.startA)}→${vLabel(gA, tc.endA)}  ` +
                `B ${vLabel(gB, tc.startB)}→${vLabel(gB, tc.endB)}${chosen}`);
            for (const op of tc.ops!) { console.log(opLine(op)); }
        }
        let pairs = 0;
        let drops = 0;
        for (const op of r.root.ops) {
            if (op.type === 'match') { pairs++; } else { drops++; }
        }
        return { pairs, drops };
    } finally {
        (globalThis as { _debug_?: unknown })._debug_ = dbgSave;
    }
}

describe('trunk-beam correspondence (hyphen-2 flipped → hyphen)', () => {
    test('left-fork prongs match top↔top / bottom↔bottom', () => {
        probe(true);   // SAT (single segment - nothing to assert)
        const mat = probe(false);
        // both prongs must MATCH - no delete+regrow at the trunk level
        expect(mat.pairs).toBe(2);
        expect(mat.drops).toBe(0);
    }, 300_000);
});
