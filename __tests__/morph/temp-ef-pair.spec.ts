// TEMP: price breakdown of E's 26-27 child vs F's 23-24 child. DELETE after.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { vertexIds$ } from '../../src/debug/segment-tree/vertex-ids.js';
import { geomOf$ } from '../../src/morph/segment-tree/geom-of.js';
import type { Segment } from '../../src/morph/segment-tree/segment.js';
import { matchSegTrees } from '../../src/morph/segment-tree/match-seg-trees/match-seg-trees.js';
import { refineMatch } from '../../src/morph/segment-tree/match-seg-trees/refine-match.js';
import { segTreeFromCp } from '../../src/morph/segment-tree/seg-tree-from-cp.js';
import { outlineLoopOf } from '../../src/morph/segment-tree/outline-loop.js';
import { prepareStaggered, STAGGER_FINE } from '../../src/morph/staggered-sat.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';
import { evalChildPair } from '../../src/debug/eval-child-pair.js';
import { getUnit$ } from '../../src/morph/segment-tree/get-unit.js';
import { lenOfSegs$ } from '../../src/morph/segment-tree/len-of.js';
import { sampleSegTree } from '../../src/morph/segment-tree/sample-seg-tree.js';
import { sampleCountFor } from '../../src/morph/segment-tree/match-seg-trees/sub-dtw-of.js';
import { TARGET_SAMPLES } from '../../src/morph/segment-tree/match-seg-trees/consts.js';
import { routeEndsOf } from '../../src/morph/segment-tree/match-seg-trees/outline-len-of.js';


const options = {
    applySat: true, simplify: false, satScale: STAGGER_FINE, maxCurviness: 0.25,
    maxLength: 10, angleIncrement: 15, simplifyTolerance: 2**-5
};


describe('temp E/F pair', () => {
    test('price', () => {
        const font = parseSvgFont(readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const matsA = findMats(getPathsFromStr(dOf('E')), options);
        const matsB = findMats(getPathsFromStr(dOf('F')), options);
        const cA = matsA.map(prepareStaggered);
        const cB = matsB.map(prepareStaggered);
        const gA = segTreeFromCp(matsA[0].cpNode);
        const gB = segTreeFromCp(matsB[0].cpNode);
        const loopA = outlineLoopOf(matsA[0].cpNode);
        const loopB = outlineLoopOf(matsB[0].cpNode);
        const w = defaultPathWeights;
        const coarse = matchSegTrees(segTreeFromCp(cA[0].cpNode), segTreeFromCp(cB[0].cpNode), loopA, loopB, w);
        const root = refineMatch(coarse, gA, gB, loopA, loopB, w);

        const segOf = (g: Segment[], x: number, y: number) => {
            const ids = vertexIds$(g);
            return g.find(s => {
                const { vertS, vertE } = geomOf$(s);
                const a = ids.get(vertS), b = ids.get(vertE);
                return (a === x && b === y) || (a === y && b === x);
            })!;
        };
        const lines: string[] = [];
        const r = evalChildPair(gA, gB, root, segOf(gA, 26, 27), segOf(gB, 23, 24), loopA, loopB, w);
        lines.push(`verdict: ${r.verdict}`);
        const p = r.price!;
        const f = (x: number) => x.toFixed(4);
        lines.push(`material a ${f(r.a!.child.material)}  b ${f(r.b!.child.material)}`);
        lines.push(`sizeFactor ${f(p.sizeFactor)}  position ${f(p.positionCost)}  angle ${f(p.angleCost)}`);
        lines.push(`sub: shape ${f(p.subShapeCost)}  sway ${f(p.subSwayCost)}  children ${f(p.subChildCost)}  score ${f(p.subCost)}`);
        lines.push(`matchCost ${f(p.matchCost)}  delete ${f(p.deleteCost)}  insert ${f(p.insertCost)}  drop both ${f(p.deleteCost + p.insertCost)}`);

        // the sub-DTW's sampling and the gap price of B's excess
        const unitA = getUnit$(loopA), unitB = getUnit$(loopB);
        const δA = lenOfSegs$(gA)/TARGET_SAMPLES, δB = lenOfSegs$(gB)/TARGET_SAMPLES;
        const sub = r.actualSub ?? p.sub;
        for (const [name, route, g, unit, δ] of [
                ['A', sub.routeA, gA, unitA, δA], ['B', sub.routeB, gB, unitB, δB]] as const) {
            const segs = route.map(s => s.seg);
            const len = lenOfSegs$(segs);
            const [, end] = routeEndsOf(route);
            const n = sampleCountFor(len, δ);
            const ss = sampleSegTree(segs, unit, n, end);
            const rMean = Array.from(ss.r).reduce((s, x) => s + x, 0)/ss.r.length;
            lines.push(`sub route ${name}: length ${len.toFixed(1)} (${(len/unit).toFixed(4)} unit)  samples ${ss.r.length}  step ${ss.step.toFixed(5)}  mean r ${rMean.toFixed(4)}  material ${ss.material.toFixed(4)}`);
        }
        lines.push(`sub gapOpen = gapOpen × mean material = ${f(w.gapOpen*(r.a!.child.material + r.b!.child.material)/2)}`);
        writeFileSync(resolve('temp-ef-pair.txt'), lines.join('\n'));
    }, 300000);
});
