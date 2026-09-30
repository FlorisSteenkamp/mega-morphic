// TEMP equivalence harness (phase A of the direct-MAT segmentation):
// segGraphFromMat must produce the SAME cut as segGraphOf - identical
// vertices and per-segment geometry/sleeves - modulo segment direction
// (walk-derived vs tip→junction) and fat-branch provenance (branch,
// fromEdge/toEdge), which the direct build deliberately lacks.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import type { Segment } from '../../src/morph/segment-graph/segment.js';
import type { MatSegment } from '../../src/morph/segment-graph/seg-graph-from-mat.js';
import { getFatBranchTree } from '../../src/morph/fat-branch/get-fat-branch-tree.js';
import { getFattestCpNode } from '../../src/morph/fat-branch/get-fattest-cp-node.js';
import { segGraphOf } from '../../src/morph/segment-graph/segment-graph.js';
import { segGraphFromMat } from '../../src/morph/segment-graph/seg-graph-from-mat.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { abs, max } = Math;

const options: MatOptions = {
    applySat: false,
    simplify: false,
    satScale: 1.5,
    maxCurviness: 0.25,
    maxLength: 40,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

const EPS = 1e-6;

const font = parseSvgFont(
    readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));

function graphsOf(glyphName: string) {
    const d = font.find(g => g.name === glyphName)!.d;
    const mats = findMats(getPathsFromStr(d), options);
    const tree = getFatBranchTree(getFattestCpNode(mats[0].cpNode))!;
    return {
        gTree: segGraphOf(tree),
        gMat: segGraphFromMat(mats[0].cpNode)
    };
}

const ptKey = (p: number[]): string =>
    `${p[0].toFixed(3)}_${p[1].toFixed(3)}`;

const endKey = (a: number[], b: number[]): string => {
    const [ka, kb] = [ptKey(a), ptKey(b)].sort();
    return `${ka}|${kb}`;
};

function maxPssDev(a: number[][][], b: number[][][]): number {
    if (a.length !== b.length) { return Infinity; }
    let dev = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i].length !== b[i].length) { return Infinity; }
        for (let j = 0; j < a[i].length; j++) {
            dev = max(dev,
                abs(a[i][j][0] - b[i][j][0]),
                abs(a[i][j][1] - b[i][j][1]));
        }
    }
    return dev;
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

function samplePss(pss: number[][][], perCurve = 32): number[][] {
    const out: number[][] = [];
    for (const ps of pss) {
        for (let i = 0; i <= perCurve; i++) {
            out.push(evalBezier(ps, i / perCurve));
        }
    }
    return out;
}

function pointToSegDist(p: number[], a: number[], b: number[]): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L2 = dx*dx + dy*dy;
    const t = L2 === 0 ? 0 : max(0, Math.min(1,
        ((p[0] - a[0])*dx + (p[1] - a[1])*dy) / L2));
    return Math.hypot(p[0] - (a[0] + t*dx), p[1] - (a[1] + t*dy));
}

/** Symmetric max distance between the two chains' sampled shapes -
 *  parameterization-independent (opposite-side mat curves share the
 *  medial geometry but not the CP layout). */
function shapeDev(a: number[][][], b: number[][][]): number {
    const pa = samplePss(a);
    const pb = samplePss(b);
    const oneWay = (ps: number[][], qs: number[][]): number => {
        let devMax = 0;
        for (const p of ps) {
            let dMin = Infinity;
            for (let i = 0; i + 1 < qs.length; i++) {
                dMin = Math.min(dMin,
                    pointToSegDist(p, qs[i], qs[i + 1]));
            }
            devMax = max(devMax, dMin);
        }
        return devMax;
    };
    return max(oneWay(pa, pb), oneWay(pb, pa));
}

/** The tree segment in the direct segment's direction (composeSegs'
 *  reversal convention). */
function oriented(s: Segment, reversed: boolean): {
        pss: number[][][];
        radii: number[];
        sleeves: readonly { out: number[][][]; back: number[][][] }[] } {

    if (!reversed) { return s; }
    return {
        pss: s.pss.map(ps => ps.toReversed()).reverse(),
        radii: s.radii.toReversed(),
        sleeves: s.sleeves.toReversed()
            .map(e => ({ out: e.back, back: e.out }))
    };
}

function compareGlyph(glyphName: string): void {
    const { gTree, gMat } = graphsOf(glyphName);

    // same vertex positions (as a set - ids/order differ)
    expect(gMat.vertices.length).toBe(gTree.vertices.length);
    const treeVs = new Set(gTree.vertices.map(v => ptKey(v.p)));
    for (const v of gMat.vertices) {
        expect(treeVs.has(ptKey(v.p))).toBe(true);
    }

    // segments match 1:1 by endpoint pair (the graph is a tree)
    expect(gMat.segments.length).toBe(gTree.segments.length);
    const byEnds = new Map<string, Segment>();
    for (const s of gTree.segments) {
        byEnds.set(endKey(
            gTree.vertices[s.v0].p, gTree.vertices[s.v1].p), s);
    }

    for (const m of gMat.segments) {
        const p0 = gMat.vertices[m.v0].p;
        const p1 = gMat.vertices[m.v1].p;
        const t = byEnds.get(endKey(p0, p1));
        expect(t).toBeDefined();

        // orientation: which tree endpoint the direct segment starts at
        const d0 = abs(gTree.vertices[t!.v0].p[0] - p0[0]) +
            abs(gTree.vertices[t!.v0].p[1] - p0[1]);
        const d1 = abs(gTree.vertices[t!.v1].p[0] - p0[0]) +
            abs(gTree.vertices[t!.v1].p[1] - p0[1]);
        const o = oriented(t!, d1 < d0);

        expect(abs(m.len - t!.len)).toBeLessThan(EPS);
        expect(abs(m.material - t!.material))
            .toBeLessThan(EPS * (1 + t!.material));

        expect(m.radii.length).toBe(o.radii.length);
        for (let i = 0; i < m.radii.length; i++) {
            expect(abs(m.radii[i] - o.radii[i])).toBeLessThan(EPS);
        }

        // skeleton chain: endpoints exact; curve SHAPES equal (the two
        // boundary sides yield differently-parameterized CP layouts of
        // the same medial curve, so CP-exact equality only holds when
        // the direct walk picked the tree's side)
        expect(m.pss.length).toBe(o.pss.length);
        const mEnd = m.pss[m.pss.length - 1];
        const oEnd = o.pss[o.pss.length - 1];
        expect(Math.hypot(
            m.pss[0][0][0] - o.pss[0][0][0],
            m.pss[0][0][1] - o.pss[0][0][1])).toBeLessThan(EPS);
        expect(Math.hypot(
            mEnd[mEnd.length - 1][0] - oEnd[oEnd.length - 1][0],
            mEnd[mEnd.length - 1][1] - oEnd[oEnd.length - 1][1]))
            .toBeLessThan(EPS);
        expect(shapeDev(m.pss, o.pss)).toBeLessThan(0.05);

        expect(m.sleeves.length).toBe(o.sleeves.length);
        for (let i = 0; i < m.sleeves.length; i++) {
            expect(maxPssDev(m.sleeves[i].out as number[][][],
                o.sleeves[i].out)).toBeLessThan(EPS);
            expect(maxPssDev(m.sleeves[i].back as number[][][],
                o.sleeves[i].back)).toBeLessThan(EPS);
        }
    }
}

describe('segGraphFromMat ≡ segGraphOf (temp phase-A harness)', () => {
    for (const glyph of ['v', 'M', 'parenleft', 'Q_V']) {
        test(`${glyph}: identical cut, geometry and sleeves`, () => {
            compareGlyph(glyph);
        });
    }
});
