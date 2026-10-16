import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { PathAlignDebug } from '../morph/match-paths/path-align-debug.js';
import type { Segment, RouteStep } from '../morph/segment-tree/segment.js';
import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { SegOp } from '../morph/segment-tree/match-seg-trees/seg-op.js';
import type { SegChild } from '../morph/segment-tree/match-seg-trees/seg-child.js';
import type { ProductDtwResult } from '../morph/segment-tree/product-dtw.js';
import { matchSegTrees } from '../morph/segment-tree/match-seg-trees/match-seg-trees.js';
import { reverseRoute } from '../morph/segment-tree/match-seg-trees/reverse-route.js';
import { subDtwOf } from '../morph/segment-tree/match-seg-trees/sub-dtw-of.js';
import { terminalGated, posCostOf, angleCostOf, dropCostOf } from '../morph/segment-tree/match-seg-trees/child-costs.js';
import { routeSegments } from '../morph/segment-tree/route-segments.js';
import { alignOfRoutes } from './align-of-routes.js';
import { anisoOf } from '../morph/segment-tree/match-seg-trees/aniso-of.js';
import { getUnit$ } from '../morph/segment-tree/get-unit.js';
import { lenOfRoute$, lenOfSegs$ } from '../morph/segment-tree/len-of.js';
import { TARGET_SAMPLES } from '../morph/segment-tree/match-seg-trees/consts.js';


/**
 * * **Debug only**
 * 
 * How a clicked segment maps to a pooled child of the winning match.
 */
interface ChildLocation {
    readonly child: SegChild;
    /** the parent pair the child is pooled on */
    readonly pair: SegMatchedPair;
    /** 'inside subtree': the segment is buried in `child`'s hanging subtree */
    readonly role: 'direct' | 'inside subtree';
    /** the winning match's actual decision for this child */
    readonly outcome: { type: SegOp['type']; partner?: SegChild };
}


/**
 * * **Debug only**
 */
interface ChildPairEval {
    readonly a?: ChildLocation;
    readonly b?: ChildLocation;
    /** pooled on the same parent pair (else the DP never compares them) */
    readonly sameParent?: boolean;
    /** in the same per-side alignment sequence (side/seam grouping) */
    readonly sameSequence?: boolean;
    readonly price?: ChildPairPrice;
    /** viz alignment of the pinned-start sub-DTW's winning route pair */
    readonly align?: PathAlignDebug;
    readonly verdict: string;
    /** the fresh winning match (current weights) */
    readonly root: SegMatchedPair;
}


/**
 * * **Debug only**
 * 
 * Prices a clicked child-segment pair with the segment matcher's actual
 * economics: a fresh `matchSegTrees` run on the SAME trees (current
 * weights - tree construction is weight-independent) locates the segments
 * as pooled children of the winning match, then the pair is priced exactly
 * as the matcher's relabel-vs-drop decision would price it.
 */
function evalChildPair(
        gA: Segment[],
        gB: Segment[],
        segA: Segment,
        segB: Segment,
        loopA: number[][][],
        loopB: number[][][],
        weights: PathCostWeights): ChildPairEval {

    const unitA = getUnit$(loopA);
    const unitB = getUnit$(loopB);
    const aniso = anisoOf(loopA, loopB);

    const root = matchSegTrees(gA, gB, loopA, loopB, weights);

    const a = locate(root, segA, 'a');
    const b = locate(root, segB, 'b');
    if (a === undefined || b === undefined) {
        return {
            ...(a !== undefined ? { a } : {}),
            ...(b !== undefined ? { b } : {}),
            root,
            verdict: 'not pooled children of the winning match (segment ' +
                'lies on a matched route?) - price undeterminable'
        };
    }

    const price = priceChildPair(
        gA, gB, unitA, unitB,
        lenOfRoute$(a.pair.routeA),
        lenOfRoute$(b.pair.routeB),
        weights, weights.sway*aniso,
        a.child, b.child
    );
    const dropCost = price.deleteCost + price.insertCost;

    const sameParent = a.pair === b.pair;
    const sameSequence =
        sameParent && seqIdOf(a.child) === seqIdOf(b.child);

    // the sub-DTW's winning route pair (start pinned at the attach vertex)
    const cand = price.dtw.candidates[0];
    const align = alignOfRoutes(
        reverseRoute(routeSegments(a.child.segs, a.child.attachV, cand.endA)),
        reverseRoute(routeSegments(b.child.segs, b.child.attachV, cand.endB)),
        unitA, unitB, weights, false);

    const verdict =
        (price.gated
            ? 'drop (terminal↔regular gate: match cost = Infinity)'
            : price.matchCost < dropCost
            ? `match (relabel ${price.matchCost.toFixed(3)} < ` +
                `drop ${dropCost.toFixed(3)})`
            : `drop (relabel ${price.matchCost.toFixed(3)} >= ` +
                `drop ${dropCost.toFixed(3)})`) +
        (!sameParent
            ? ' - HYPOTHETICAL: pooled on different parent pairs, ' +
                'the DP never compares them'
            : !sameSequence
            ? ' - HYPOTHETICAL: different alignment sequences (side/seam), ' +
                'the DP never compares them'
            : ' (in isolation; sequence order can override)');

    return { a, b, sameParent, sameSequence, price, align, verdict, root };
}


/** One child pair priced by the matcher's actual economics. */
interface ChildPairPrice {
    /** terminal↔regular gate fired: `matchCost` = Infinity */
    readonly gated: boolean;
    readonly positionCost: number;
    readonly angleCost: number;
    /** pinned-start sub-DTW total incl. measured warp sway */
    readonly dtwCost: number;
    /** position + angle + dtw (the DP's relabel price; Infinity when gated) */
    readonly matchCost: number;
    readonly deleteCost: number;
    readonly insertCost: number;
    readonly dtw: ProductDtwResult;
}


/**
 * Prices one child pair exactly as the matcher's `matchCost` / `delCost` /
 * `insCost` would (fresh, unmemoized) - the authoritative relabel-vs-drop
 * economics for the pair. Route lengths are the PARENT routes the children
 * are pooled on (position is a route fraction).
 */
function priceChildPair(
        gA: Segment[],
        gB: Segment[],
        unitA: number,
        unitB: number,
        routeLenA: number,
        routeLenB: number,
        weights: PathCostWeights,
        sway: number,
        a: SegChild,
        b: SegChild): ChildPairPrice {

    const dtw = subDtwOf(
        gA, gB,
        unitA, unitB,
        getSampleSpacing(gA),
        getSampleSpacing(gB),
        weights, sway, a, b
    );

    const gated = terminalGated(a, b);
    const positionCost = posCostOf(unitA, unitB, weights)(
        a, b, routeLenA, routeLenB);
    const angleCost = angleCostOf(weights)(a, b);
    const matchCost = gated
            ? Infinity
            : positionCost + angleCost + dtw.totalCost + dtw.swayCost;

    return {
        gated,
        positionCost,
        angleCost,
        dtwCost: dtw.totalCost + dtw.swayCost,
        matchCost,
        deleteCost: dropCostOf(weights)(a),
        insertCost: dropCostOf(weights)(b),
        dtw
    };
}

/** trunk-level sample spacing of a tree */
function getSampleSpacing(g: Segment[]): number {
    return lenOfSegs$(g) / TARGET_SAMPLES;
}


/**
 * The per-side alignment sequence the child lands in (mirrors `seqOf`:
 * seam terminals join the out (+1) / back (-1) sequence by seam, not side).
 */
function seqIdOf(c: SegChild): 1 | -1 {
    return c.terminal !== undefined
        ? (c.terminal === 'end' ? 1 : -1)
        : c.side;
}


/**
 * Finds the segment among the winning match's pooled children (all children
 * appear in `ops` as match/delete/insert). Direct hits (the child hangs
 * through the segment) win over merely containing subtrees.
 */
function locate(
        root: SegMatchedPair,
        seg: Segment,
        key: 'a' | 'b'): ChildLocation | undefined {

    let direct: ChildLocation | undefined;
    let containing: ChildLocation | undefined;

    const visit = (pair: SegMatchedPair): void => {
        for (const op of pair.ops) {
            const c = key === 'a'
                ? (op.type !== 'insert' ? op.a : undefined)
                : (op.type !== 'delete' ? op.b : undefined);
            if (c !== undefined) {
                const role: ChildLocation['role'] =
                    c.entry === seg ? 'direct'
                    : 'inside subtree';
                const outcome: ChildLocation['outcome'] =
                    op.type === 'match'
                        ? { type: 'match',
                            partner: key === 'a' ? op.b : op.a }
                        : { type: op.type };
                const loc: ChildLocation = { child: c, pair, role, outcome };

                if (role === 'direct') {
                    direct ??= loc;
                } else if (containing === undefined &&
                        c.segs.includes(seg)) {
                    containing = loc;
                }
            }
            if (op.type === 'match') { visit(op.sub); }
        }
    };
    visit(root);

    return direct ?? containing;
}


export type { ChildPairEval, ChildLocation, ChildPairPrice }
export { evalChildPair }
