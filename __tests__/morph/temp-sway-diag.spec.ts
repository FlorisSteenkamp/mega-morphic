// TEMP diagnostic: M→N sway breakdown - global mean-angle sway vs a
// correspondence-local sway per trunk candidate. DELETE after diagnosis.
import { describe, test } from '@jest/globals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMats, getPathsFromStr, MatOptions } from 'flo-mat';
import { defaultPathWeights } from '../../src/morph/match-paths/path-cost-weights.js';
import { segGraphFromMat } from '../../src/morph/segment-graph/seg-graph-from-mat.js';
import { routeSegments } from '../../src/morph/segment-graph/route-segments.js';
import type { SegGraph } from '../../src/morph/segment-graph/seg-graph.js';
import { matchSegGraphs, composeRoute } from '../../src/morph/segment-graph/match-seg-graphs.js';
import type { RouteStep } from '../../src/morph/segment-graph/match-seg-graphs.js';
import { procrustes } from '../../src/morph/procrustes/procrustes-analysis.js';
import { unwrappedChordAngles } from '../../src/morph/intrinsic-skeleton/unwrapped-chord-angles.js';
import { wrapAngle } from '../../src/morph/intrinsic-skeleton/wrap-angle.js';
import { totalLength$ } from '../../src/morph/fs/total-length.js';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';

const { sqrt, abs, PI: π } = Math;

const options: MatOptions = {
    applySat: false,
    simplify: false,
    satScale: 1.5,
    maxCurviness: 0.25,
    maxLength: 40,
    angleIncrement: 15,
    simplifyTolerance: 2**-5
};

function loadGraph(glyphName: string): SegGraph {
    const font = parseSvgFont(
        readFileSync(resolve('fonts-test/achispado.svg'), 'utf-8'));
    const d = font.find(g => g.name === glyphName)!.d;
    const mats = findMats(getPathsFromStr(d), options);
    return segGraphFromMat(mats[0].cpNode);
}

function meanAngleOf(route: RouteStep[]): number {
    const bz = composeRoute(route).skelPss;
    const ψs = unwrappedChordAngles(bz);
    let s = 0, total = 0;
    for (let i = 0; i < bz.length; i++) {
        const l = totalLength$(bz[i]);
        s += ψs[i]*l; total += l;
    }
    return total === 0 ? 0 : s/total;
}

/** piecewise-constant unwrapped angle by arc-length fraction */
function angleProfile(route: RouteStep[]):
        { at: (u: number) => number; L: number } {
    const bz = composeRoute(route).skelPss;
    const ψs = unwrappedChordAngles(bz);
    const cum = [0];
    for (const b of bz) { cum.push(cum[cum.length - 1] + totalLength$(b)); }
    const L = cum[cum.length - 1];
    return {
        L,
        at: (u: number): number => {
            const s = u*L;
            let i = 0;
            while (i < bz.length - 1 && cum[i + 1] < s) { i++; }
            return ψs[i];
        }
    };
}

/** length-weighted mean of the locally-wrapped, u-unwrapped angle diff */
function localSway(rA: RouteStep[], rB: RouteStep[]): number {
    const A = angleProfile(rA);
    const B = angleProfile(rB);
    const N = 128;
    let prev: number | undefined = undefined;
    let s = 0;
    for (let i = 0; i <= N; i++) {
        const u = i/N;
        let δ = B.at(u) - A.at(u);
        δ = prev === undefined ? wrapAngle(δ) : prev + wrapAngle(δ - prev);
        prev = δ;
        s += δ;
    }
    return abs(wrapAngle(s/(N + 1)))/π;
}

/** radius+angle profile by arc fraction */
function fullProfile(route: RouteStep[]):
        { ψ: (u: number) => number; r: (u: number) => number } {
    const { skelPss, radii } = composeRoute(route);
    const ψs = unwrappedChordAngles(skelPss);
    const cum = [0];
    for (const b of skelPss) {
        cum.push(cum[cum.length - 1] + totalLength$(b));
    }
    const L = cum[cum.length - 1];
    const idx = (u: number): number => {
        const s = u*L;
        let i = 0;
        while (i < skelPss.length - 1 && cum[i + 1] < s) { i++; }
        return i;
    };
    return {
        ψ: (u: number): number => ψs[idx(u)],
        r: (u: number): number => {
            const i = idx(u);
            return (radii[i] + radii[i + 1])/2;
        }
    };
}

/** material-weighted mean |wrap(δ)| - local absolute rotation */
function localAbsSway(rA: RouteStep[], rB: RouteStep[]): number {
    const A = fullProfile(rA);
    const B = fullProfile(rB);
    const N = 128;
    let s = 0, w = 0;
    for (let i = 0; i < N; i++) {
        const u = (i + 0.5)/N;
        const δ = abs(wrapAngle(B.ψ(u) - A.ψ(u)));
        const wt = (A.r(u) + B.r(u))/2;
        s += wt*δ;
        w += wt;
    }
    return w === 0 ? 0 : (s/w)/π;
}

describe('temp sway diagnostic', () => {
    test('M → N trunk candidates', () => {
        const gA = loadGraph('M');
        const gB = loadGraph('N');
        // AFTER findMats - flo-boolean's debug branches crash on a bare {}
        (globalThis as any)._debug_ = {};
        const uA = gA.unit;
        const uB = gB.unit;
        const aniso = (procrustes(gA.loop).anisotropy +
            procrustes(gB.loop).anisotropy) / 2;

        const vtx = (g: SegGraph, i: number): string => {
            const v = g.vertices[i];
            return `${i}${v.leaf ? 'L' : 'F'}(${v.p[0].toFixed(0)},${
                v.p[1].toFixed(0)})`;
        };

        const lines: string[] = [];
        lines.push(`aniso ${aniso.toFixed(3)}  unitA ${uA.toFixed(1)} unitB ${
            uB.toFixed(1)}`);
        lines.push(`A vertices: ${gA.vertices.map(
            (_, i) => vtx(gA, i)).join(' ')}`);
        lines.push(`B vertices: ${gB.vertices.map(
            (_, i) => vtx(gB, i)).join(' ')}`);

        for (const sway of [0, 0.1, 0.5, 1, 2]) {
            const r = matchSegGraphs(gA, gB, uA, uB,
                { ...defaultPathWeights, sway }, aniso);
            lines.push('');
            lines.push(`=== sway weight ${sway} ===`);
            lines.push(`chosen: startA ${vtx(gA, r.trunkStartA)} startB ${
                vtx(gB, r.trunkStartB)}  cost ${r.cost.toFixed(3)}`);
            const ops = r.root.ops.map(o =>
                o.type === 'match' ? 'M' : o.type === 'delete' ? 'D' : 'I')
                .join('');
            lines.push(`root ops: ${ops}`);
            for (const c of r.trunkCands ?? []) {
                const rA = routeSegments(gA, c.startA, c.endA);
                const rB = routeSegments(gB, c.startB, c.endB);
                const gSway = abs(wrapAngle(
                    meanAngleOf(rB) - meanAngleOf(rA)))/π;
                const lSway = localSway(rA, rB);
                const laSway = localAbsSway(rA, rB);
                lines.push(`  A ${vtx(gA, c.startA)}→${vtx(gA, c.endA)}  B ${
                    vtx(gB, c.startB)}→${vtx(gB, c.endB)}  dp ${
                    c.dpTotal.toFixed(3)} cheap ${c.cheap.toFixed(3)} sway ${
                    c.sway.toFixed(3)} rank ${c.rank.toFixed(3)}${
                    c.recCost !== undefined
                        ? ` rec ${c.recCost.toFixed(3)} sel ${
                            c.sel!.toFixed(3)}` : ''
                    }  | globalMeanΔ ${gSway.toFixed(3)}π localΔ ${
                    lSway.toFixed(3)}π absΔ ${laSway.toFixed(3)}π`);
                if (c.ops !== undefined) {
                    lines.push(`    A route: ${rA.map(s => `${
                        vtx(gA, s.reversed ? s.seg.v1 : s.seg.v0)}`)
                        .join('>')}>${vtx(gA, c.endA)}`);
                    lines.push(`    B route: ${rB.map(s => `${
                        vtx(gB, s.reversed ? s.seg.v1 : s.seg.v0)}`)
                        .join('>')}>${vtx(gB, c.endB)}`);
                    for (const op of c.ops) {
                        const ch = (x: { attachV: number; dist: number;
                                side: number; material: number;
                                terminal?: string }, g: SegGraph): string =>
                            `@${vtx(g, x.attachV)} d${x.dist.toFixed(0)} s${
                            x.side} m${x.material.toFixed(2)}${
                            x.terminal !== undefined ? ` T:${x.terminal}` : ''}`;
                        lines.push(op.type === 'match'
                            ? `    M a ${ch(op.a, gA)}  b ${ch(op.b, gB)}  ` +
                                `subCost ${op.sub.cost.toFixed(3)}`
                            : op.type === 'delete'
                            ? `    D a ${ch(op.a, gA)}`
                            : `    I b ${ch(op.b, gB)}`);
                    }
                }
            }
        }
        writeFileSync(resolve('temp-sway-diag.txt'), lines.join('\n'));
        delete (globalThis as any)._debug_;
    }, 120000);
});
