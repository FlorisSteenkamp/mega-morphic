// TEMP diagnostic: k→x staggered match dump. DELETE after diagnosis.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr } from 'flo-mat';
import type { Circle } from 'flo-mat';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { vertexIds$ } from '../../src/debug/segment-tree/vertex-ids.js';
import { geomOf$ } from '../../src/morph/segment-tree/geom-of.js';
import type { Segment } from '../../src/morph/segment-tree/segment.js';
import { matchSegTrees } from '../../src/morph/segment-tree/match-seg-trees/match-seg-trees.js';
import { refineMatch } from '../../src/morph/segment-tree/match-seg-trees/refine-match.js';
import type { SegMatchedPair } from '../../src/morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { SegChild } from '../../src/morph/segment-tree/match-seg-trees/seg-child.js';
import { segTreeFromCp } from '../../src/morph/segment-tree/seg-tree-from-cp.js';
import { outlineLoopOf } from '../../src/morph/segment-tree/outline-loop.js';
import { prepareStaggered, STAGGER_FINE } from '../../src/morph/staggered-sat.js';
import { routeEndsOf } from '../../src/morph/segment-tree/match-seg-trees/outline-len-of.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';
import { getShapeArea } from 'flo-boolean';
import { routeSegments } from '../../src/morph/segment-tree/route-segments.js';


const options = {
    applySat: true,
    simplify: false,
    satScale: STAGGER_FINE,
    maxCurviness: 0.25,
    maxLength: 10,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};


describe('temp k→x diagnostic', () => {
    test('k → x staggered', () => {
        const font = parseSvgFont(
            readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
        const dOf = (n: string) => font.find(g => g.name === n)!.d;
        const matsA = findMats(getPathsFromStr(dOf(process.env.GA ?? 'k')), options);
        const matsB = findMats(getPathsFromStr(dOf(process.env.GB ?? 'x')), options);
        const coarseA = matsA.map(prepareStaggered);
        const coarseB = matsB.map(prepareStaggered);
        (globalThis as any)._debug_ = { elems: { trunkCands: [] } };

        const gA = segTreeFromCp(matsA[0].cpNode);
        const gB = segTreeFromCp(matsB[0].cpNode);
        const loopA = outlineLoopOf(matsA[0].cpNode);
        const loopB = outlineLoopOf(matsB[0].cpNode);
        const cA = segTreeFromCp(coarseA[0].cpNode);
        const cB = segTreeFromCp(coarseB[0].cpNode);

        const lines: string[] = [];
        const idA = vertexIds$(gA);
        const idB = vertexIds$(gB);
        const vtx = (ids: Map<Circle, number>, v: Circle) => {
            const p = v.center;
            return `${ids.get(v) ?? '?'}(${p[0].toFixed(0)},${p[1].toFixed(0)})`;
        };
        const edges = (g: Segment[], ids: Map<Circle, number>) =>
            g.map(s => {
                const { vertS, vertE } = geomOf$(s);
                return `${ids.get(vertS)}-${ids.get(vertE)}`;
            }).join(' ');

        lines.push(`mats: A ${matsA.length} B ${matsB.length}`);
        lines.push(`A fine vertices: ${[...idA.keys()].map(v => vtx(idA, v)).join(' ')}`);
        lines.push(`B fine vertices: ${[...idB.keys()].map(v => vtx(idB, v)).join(' ')}`);
        lines.push(`A fine edges: ${edges(gA, idA)}`);
        lines.push(`B fine edges: ${edges(gB, idB)}`);
        lines.push(`A coarse edges: ${edges(cA, idA)}`);
        lines.push(`B coarse edges: ${edges(cB, idB)}`);

        const segInfo = (g: Segment[], ids: Map<Circle, number>, names: number[]) => {
            for (const s of g) {
                const { vertS, vertE, skelPss, skelLen, material } = geomOf$(s);
                const a = ids.get(vertS)!, b = ids.get(vertE)!;
                if (!names.includes(a) && !names.includes(b)) { continue; }
                const f = skelPss[0], l = skelPss[skelPss.length - 1];
                const P = (q: number[]) => `(${q[0].toFixed(1)},${q[1].toFixed(1)})`;
                lines.push(`  ${a}-${b} len ${skelLen.toFixed(1)} mat ${material.toFixed(0)} rS ${
                    vertS.radius.toFixed(1)} rE ${vertE.radius.toFixed(1)} bz ${skelPss.length} first ${
                    P(f[0])}->${P(f[f.length-1])} last ${P(l[0])}->${P(l[l.length-1])}`);
            }
        };
        lines.push('A fine near 13:'); segInfo(gA, idA, [13,19,20,21,22,27,14,12]);
        lines.push('A coarse near 13:'); segInfo(cA, idA, [13,22,14,12]);
        lines.push('B fine near 15:'); segInfo(gB, idB, [15,16,17,21,22,27,29,14]);
        lines.push('B coarse near 15:'); segInfo(cB, idB, [15,17,21,22,29,14]);
        const sleeveInfo = (g: Segment[], ids: Map<Circle, number>, a: number, b: number) => {
            const P = (q: number[]) => `(${q[0].toFixed(1)},${q[1].toFixed(1)})`;
            for (const s of g) {
                const { vertS, vertE, sleeves } = geomOf$(s);
                if (ids.get(vertS) !== a || ids.get(vertE) !== b) { continue; }
                sleeves.forEach((sl, i) => {
                    const o = sl.out.flat(), k = sl.back.flat();
                    lines.push(`    step ${i}: out ${o.length ? P(o[0]) + '->' + P(o[o.length-1]) : '-'}  back ${
                        k.length ? P(k[0]) + '->' + P(k[k.length-1]) : '-'}`);
                });
            }
        };
        lines.push('B coarse 15-17 sleeves:'); sleeveInfo(cB, idB, 15, 17);
        lines.push('B fine 15-16 sleeves:'); sleeveInfo(gB, idB, 15, 16);
        const closedArea = (s: Segment) => {
            const { vertS, vertE, sleeves } = geomOf$(s);
            const out = sleeves.flatMap(e => e.out);
            const back = sleeves.toReversed().flatMap(e => e.back);
            if (!out.length || !back.length) { return 0; }
            const last = (pss: number[][][]) => { const ps = pss[pss.length-1]; return ps[ps.length-1]; };
            const raw = [...out, [last(out), vertE.center], [vertE.center, back[0][0]],
                ...back, [last(back), vertS.center], [vertS.center, out[0][0]]];
            const closed: number[][][] = [];
            for (const ps of raw) {
                if (closed.length) {
                    const q = last(closed);
                    if (q[0] !== ps[0][0] || q[1] !== ps[0][1]) { closed.push([q, ps[0]]); }
                }
                closed.push(ps);
            }
            const ar = getShapeArea(closed);
            return Math.abs(ar);
        };
        const cmp = (c: Segment[], g: Segment[], ids: Map<Circle, number>, name: string) => {
            lines.push(`${name} coarse material vs gap-closed vs fine-route sum:`);
            for (const s of c) {
                const { vertS, vertE, material } = geomOf$(s);
                const fineSum = routeSegments(g, vertS, vertE)
                    .reduce((t, st) => t + geomOf$(st.seg).material, 0);
                lines.push(`  ${ids.get(vertS)}-${ids.get(vertE)} mat ${material.toFixed(0)} closed ${
                    closedArea(s).toFixed(0)} fineRoute ${fineSum.toFixed(0)}`);
            }
        };
        cmp(cA, gA, idA, 'A');
        cmp(cB, gB, idB, 'B');
        if (process.env.FIX_AREA === '1') {
            for (const s of [...cA, ...cB]) {
                (geomOf$(s) as any).material = closedArea(s);
            }
            lines.push('*** coarse materials patched to gap-closed areas ***');
        }
        for (const s of cB) {
            const { vertS, vertE, sleeves } = geomOf$(s);
            if (idB.get(vertS) !== 15 || idB.get(vertE) !== 17) { continue; }
            const last = sleeves[sleeves.length - 1];
            lines.push(`  last out: ${JSON.stringify(last.out.map(ps => ps.map(p => p.map(x => +x.toFixed(1)))))}`);
            lines.push(`  last back: ${JSON.stringify(last.back.map(ps => ps.map(p => p.map(x => +x.toFixed(1)))))}`);
        }
        const w = { ...defaultPathWeights };
        lines.push(`weights: ${JSON.stringify(w)}`);

        const ch = (ids: Map<Circle, number>, c: SegChild) => {
            const { vertS, vertE } = geomOf$(c.entry);
            return `@${vtx(ids, c.attachV)} entry ${ids.get(vertS)}-${
                ids.get(vertE)} d${c.dist.toFixed(0)} s${c.side} ang${
                (c.angle*180/Math.PI).toFixed(0)} m${c.material.toFixed(3)} op${
                c.outlinePos.toFixed(0)}${c.terminal ? ` T:${c.terminal}` : ''}`;
        };
        const dump = (p: SegMatchedPair, ind: string) => {
            const [sA, eA] = routeEndsOf(p.routeA);
            const [sB, eB] = routeEndsOf(p.routeB);
            lines.push(`${ind}PAIR A ${vtx(idA, sA)}→${vtx(idA, eA)}  B ${
                vtx(idB, sB)}→${vtx(idB, eB)}  shape ${p.shapeCost.toFixed(4)} cost ${
                p.cost.toFixed(4)} sway ${p.sway.toFixed(4)}`);
            for (const op of p.ops) {
                if (op.type === 'match') {
                    lines.push(`${ind}  M a ${ch(idA, op.a)}`);
                    lines.push(`${ind}    b ${ch(idB, op.b)}`);
                    dump(op.sub, ind + '      ');
                } else if (op.type === 'delete') {
                    lines.push(`${ind}  D a ${ch(idA, op.a)}`);
                } else {
                    lines.push(`${ind}  I b ${ch(idB, op.b)}`);
                }
            }
        };

        const coarse = matchSegTrees(cA, cB, loopA, loopB, w);
        lines.push('', '=== COARSE ===');
        dump(coarse, '');
        const fine = refineMatch(coarse, gA, gB, loopA, loopB, w);
        lines.push('', '=== REFINED ===');
        dump(fine, '');

        writeFileSync(resolve(process.env.OUT ?? 'temp-kx-diag.txt'), lines.join('\n'));
        delete (globalThis as any)._debug_;
    }, 120000);
});
