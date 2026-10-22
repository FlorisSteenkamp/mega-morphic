declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { PathMatchResult } from '../../debug/path-match-result.js';
import type { PathCostWeights } from '../../morph/match-paths/path-cost-weights.js';
import type { SegMatchedPair } from '../../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { SegOp } from '../../morph/segment-tree/match-seg-trees/seg-op.js';
import type { PathAlignDebug } from '../../morph/match-paths/path-align-debug.js';
import type { Circle } from 'flo-mat';
import type { Segment, RouteStep } from '../../morph/segment-tree/segment.js';
import { vertexIds$ } from '../../debug/segment-tree/vertex-ids.js';
import { geomOf$ } from '../../morph/segment-tree/geom-of.js';
import type { ChildLocation } from '../../debug/eval-child-pair.js';
import { evalChildPair } from '../../debug/eval-child-pair.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { drawAlignSteps, distToPss, svgGroup } from './align-viz.js';
import { matchColors } from '../events/match-colors.js';
import { lenOf$ } from '../../morph/segment-tree/len-of.js';
import type { PairInTree } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
import { pairsOf } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
import { scoreOf } from '../../morph/segment-tree/match-seg-trees/score-of.js';


/** One side's selection: a segment, or the trunk-pair route. */
type Sel = { seg?: Segment; trunk?: boolean };

/** Two-click selection state (debug tool - module scope suffices). */
let selA: Sel | undefined;
let selB: Sel | undefined;

/** tags the first click's selection highlight, for removal */
const SEL_CLASS = 'dtw-sel';


/**
 * Two-click child-pair DTW: a click on svg1/svg2 selects the nearest
 * MATCHED route segment (the material the match view paints - the pair's
 * whole route is highlighted and its selection identity is the pair's own
 * entry segment) or, when an uncovered segment is nearer, that segment;
 * once both sides are selected the pair is priced FRESH with the current
 * weights using the SEGMENT matcher's actual economics (`evalChildPair`)
 * and the sub-DTW's alignment is drawn on both svgs. Selecting both trunk
 * routes shows the WINNING trunk pair instead (actual routes + coverage).
 */
function logChildDtw(
        shapeIdx: 1 | 2,
        weights: PathCostWeights) {

    return function(g: SVGGElement, p: number[], showDelay?: number): void {
        if (typeof _debug_ === 'undefined') { return; }
        const pm = _debug_.elems.pathMatchResult[0];
        if (pm === undefined) {
            console.log('no match yet - click morph first');
            return;
        }

        const { gA, gB } = pm;

        const tree = shapeIdx === 1 ? gA : gB;
        const pairs = pairsOf(pm.trunk);

        // matched route segments first (they are what the match view
        // paints; on a tie the matched interpretation wins), then any
        // segment - one uniform metric
        let nearest: Segment | undefined;
        let hitPair: PairInTree | undefined;
        let bestD = Infinity;
        for (const pair of pairs) {
            const route = shapeIdx === 1
                ? pair.mp.routeA : pair.mp.routeB;
            for (const st of route) {
                const d = distToPss(p, geomOf$(st.seg).skelPss);
                if (d < bestD) {
                    bestD = d;
                    hitPair = pair;
                    nearest = shapeIdx === 1 ? pair.segA : pair.segB;
                }
            }
        }
        for (const seg of tree) {
            const d = distToPss(p, geomOf$(seg).skelPss);
            if (d < bestD) { bestD = d; hitPair = undefined; nearest = seg; }
        }

        const sel: Sel = hitPair !== undefined
            ? { seg: nearest, trunk: hitPair.idx === 0 }
            : { seg: nearest };
        if (shapeIdx === 1) { selA = sel; } else { selB = sel; }

        const what = hitPair !== undefined
            ? hitPair.idx === 0
                ? 'the TRUNK pair route'
                : `matched pair #${hitPair.idx} (${
                    matchColors[hitPair.idx % matchColors.length]})`
            : 'an uncovered segment';

        if (selA === undefined || selB === undefined) {
            // the selection is shown only while the other side is still
            // to be picked - once both are, the alignment shows it
            const color = shapeIdx === 1 ? 'red' : 'green';
            if (hitPair !== undefined) {
                // the pair's whole matched route (covered segments only)
                const route = shapeIdx === 1
                    ? hitPair.mp.routeA : hitPair.mp.routeB;
                drawBeziersAsSinglePath(g, route.flatMap(st => geomOf$(st.seg).skelPss),
                    `thin35 ${color} nofill ${SEL_CLASS}`, showDelay);
            } else if (nearest !== undefined) {
                drawBeziersAsSinglePath(g, geomOf$(nearest).skelPss,
                    `thin20 ${color} nofill ${SEL_CLASS}`, showDelay);
            }

            console.log(`selected ${what} on svg${shapeIdx} - ` +
                `now click a segment on svg${shapeIdx === 1 ? 2 : 1}`);
            return;
        }
        console.log(`selected ${what} on svg${shapeIdx}`);

        clearSelection();

        if (selA.trunk === true && selB.trunk === true) {
            logTrunkPair(pm, showDelay);
            return;
        }
        if (selA.seg === undefined || selB.seg === undefined) {
            console.log('trunk route selected on one side only - select ' +
                'two child segments (or both trunk routes)');
            return;
        }

        evaluate(pm, selA.seg, selB.seg, weights, showDelay);
    };
}


/** Removes the selection highlight from both svgs. */
function clearSelection(): void {
    for (const id of ['svg', 'svg2']) {
        svgGroup(id)?.querySelectorAll(`.${SEL_CLASS}`).forEach($ => $.remove());
    }
}


/**
 * Shows the WINNING trunk pair: its DTW barber-pole plus a coverage
 * breakdown per piece - uncovered slices are the material that retracts
 * (grow/retract asymmetries live here).
 */
function logTrunkPair(pm: PathMatchResult, showDelay?: number): void {
    const mp = pm.trunk;

    const g1 = svgGroup('svg');
    const g2 = svgGroup('svg2');
    if (g1 === undefined || g2 === undefined) { return; }

    if (mp.align === undefined ||
        !drawAlignSteps(g1, g2, mp.align, showDelay)) {
        console.log('trunk align data unavailable', mp);
    }

    const { cost, shapeCost } = mp;

    console.log('trunk pair dtw:', {
        cost: {
            total: cost,
            shapeCost,
            childCost: cost - shapeCost
        },
        routeA: describeRoute(mp.routeA, vertexIds$(pm.gA)),
        routeB: describeRoute(mp.routeB, vertexIds$(pm.gB)),
        // long gap runs collapse material to a point on the other side
        // (grow/retract despite full coverage) - u ranges of runs > 3 samples
        gapRuns: mp.align === undefined ? undefined : gapRuns(mp.align),
        // the DRAWN warp is alignBranches pinned at these anchors - a pair
        // with wildly different u values squeezes the material next to it
        anchors: anchorsOf(mp),
        childOps: summarize(mp.ops),
        trunk: mp
    });
}


/** Maximal gap runs (> 3 samples) of the trunk alignment, with u ranges. */
function gapRuns(al: PathAlignDebug): string[] {
    const out: string[] = [];
    let runStart = -1;
    let runState: 0 | 1 | 2 = 0;
    const flush = (endIdx: number): void => {
        if (runStart < 0 || endIdx - runStart <= 3) { runStart = -1; return; }
        const s0 = al.steps[runStart];
        const s1 = al.steps[endIdx - 1];
        out.push(runState === 1
            ? `gap in A: uA [${al.usA[s0.i].toFixed(3)}..${
                al.usA[s1.i].toFixed(3)}] maps to uB ~${
                al.usB[s0.j].toFixed(3)} (${endIdx - runStart} samples)`
            : `gap in B: uB [${al.usB[s0.j].toFixed(3)}..${
                al.usB[s1.j].toFixed(3)}] maps to uA ~${
                al.usA[s0.i].toFixed(3)} (${endIdx - runStart} samples)`);
        runStart = -1;
    };
    for (let k = 0; k < al.steps.length; k++) {
        const st = al.steps[k].state;
        if (st !== runState) {
            flush(k);
            if (st !== 0) { runStart = k; runState = st; }
            else { runState = 0; }
        }
    }
    flush(al.steps.length);
    return out;
}


/** The pair's matched child-fork anchors: normalized positions per side. */
function anchorsOf(mp: SegMatchedPair): string[] {
    const { align, ops } = mp;
    if (align === undefined) { return []; }

    const LA = lenOf$(align.skelPssA);
    const LB = lenOf$(align.skelPssB);

    return ops.flatMap(op => {
        if (op.type !== 'match') { return []; }

        const uA = op.a.dist / LA;
        const uB = op.b.dist / LB;
        return [`uA ${uA.toFixed(3)} ↔ uB ${uB.toFixed(3)} ` +
            `(Δu ${(uA - uB).toFixed(3)}, side ${op.a.side})`];
    });
}


/** Route steps in travel order: vertex hops (ids as `showVertexNums`) +
 *  segment lengths. */
function describeRoute(
        route: RouteStep[],
        ids: Map<Circle, number>): string[] {

    return route.map(({ seg, reversed }) => {
        const { vertS, vertE, skelPss } = geomOf$(seg);
        const s = ids.get(vertS);
        const e = ids.get(vertE);
        return `${reversed ? `v${e}→v${s}` : `v${s}→v${e}`} len ${
            lenOf$(skelPss).toFixed(0)}`;
    });
}


/** Prices the selected pair with the SEGMENT matcher's actual economics. */
function evaluate(
        pm: PathMatchResult,
        segA: Segment,
        segB: Segment,
        weights: PathCostWeights,
        showDelay?: number): void {

    const { gA, gB, loopA, loopB } = pm;
    const r = evalChildPair(
        gA, gB, pm.trunk, segA, segB, loopA, loopB, weights);

    if (r.align !== undefined) {
        const g1 = svgGroup('svg');
        const g2 = svgGroup('svg2');
        if (g1 !== undefined && g2 !== undefined &&
            !drawAlignSteps(g1, g2, r.align, showDelay)) {
            console.log('degenerate alignment (too few samples)');
        }
    }

    const price = r.price;
    console.log('child pair dtw:', {
        // the matcher's decision inputs: matchCost vs delCost + insCost
        cost: price === undefined ? undefined : {
            // the plain entries are the summands of the total; bracketed
            // ones are for reference only (not to be added)
            match: {
                // feature intervals through the parent routes' warp, and
                // the angle - both already times the size factor
                positionCost: price.positionCost,
                angleCost: price.angleCost,
                // the best fully built sub-pair: its routes' shape, its
                // routes' sway (already times the size factor) and its
                // recursive child costs
                subShapeCost: price.subShapeCost,
                subSwayCost: price.subSwayCost,
                subChildCost: price.subChildCost,
                "total match cost": price.matchCost,
                "(sub-pair subtotal: shape + sway + children)": price.subCost,
                "(sizeFactor: already applied to position, angle and sub sway)":
                    price.sizeFactor
            },
            drop: {
                deleteCost: price.deleteCost,
                insertCost: price.insertCost,
                "total drop cost": price.deleteCost + price.insertCost
            }
        },
        verdict: r.verdict,
        // which sub-pair the alignment shows: the match's own (a staggered
        // match keeps a coarse pair's sub-routes, which the free pricing
        // above may not pick) or, when the two aren't matched together,
        // the priced best one
        drawn: describeDrawn(r.actualSub, price?.sub),
        selectionA: describeLoc(r.a),
        selectionB: describeLoc(r.b),
        // the DP only ever compares children pooled on the same parent pair
        sameParent: r.sameParent,
        // the morph's winning match, for digging
        root: r.root
    });
}


/** Which sub-pair the alignment shows, and how it compares to the priced. */
function describeDrawn(
        actual: SegMatchedPair | undefined,
        priced: SegMatchedPair | undefined): string {

    if (actual === undefined) {
        return 'the priced best sub-pair (the two are not matched together)';
    }
    const same = priced !== undefined &&
        isSameRoute(actual.routeA, priced.routeA) &&
        isSameRoute(actual.routeB, priced.routeB);

    return `the match's own sub-pair (score ${scoreOf(actual).toFixed(3)}) - ` +
        (same
            ? 'the same routes as the priced one'
            : `NOT the priced one (score ${
                priced === undefined ? '-' : scoreOf(priced).toFixed(3)}): ` +
                'kept from the coarse match');
}


/** Returns `true` if the two routes run through the same segments. */
function isSameRoute(
        r1: RouteStep[],
        r2: RouteStep[]): boolean {

    return r1.length === r2.length &&
        r1.every((st, k) => st.seg === r2[k].seg);
}


/** Human-readable summary of one selection's pooled-child location. */
function describeLoc(loc: ChildLocation | undefined): unknown {
    if (loc === undefined) {
        return 'not a pooled child of the winning match (on a route?)';
    }
    const c = loc.child;
    return {
        role: loc.role,
        side: c.side,
        terminal: c.terminal,
        dist: c.dist,
        angle: c.angle,
        material: c.material,
        // what the winning match actually did with this child
        outcome: loc.outcome.type,
        partner: loc.outcome.partner,
        child: c
    };
}


/** Op counts of the pair's recursive child alignment. */
function summarize(ops: SegOp[]): Record<SegOp['type'], number> {
    const out = { match: 0, delete: 0, insert: 0 };
    for (const op of ops) { out[op.type]++; }
    return out;
}


export { logChildDtw }
