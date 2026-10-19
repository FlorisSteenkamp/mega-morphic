import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { PathAlignDebug } from '../morph/match-paths/path-align-debug.js';
import type { Segment } from '../morph/segment-tree/segment.js';
import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { SegOp } from '../morph/segment-tree/match-seg-trees/seg-op.js';
import type { SegChild } from '../morph/segment-tree/match-seg-trees/seg-child.js';
import { matchSegTrees } from '../morph/segment-tree/match-seg-trees/match-seg-trees.js';
import { calcChildPosCost, calcAngleCost, calcDropCost } from '../morph/segment-tree/match-seg-trees/child-costs.js';
import { alignOfRoutes } from './align-of-routes.js';
import { anisoOf } from '../morph/segment-tree/match-seg-trees/aniso-of.js';
import { getUnit$ } from '../morph/segment-tree/get-unit.js';
import { outlineLenOf } from '../morph/segment-tree/match-seg-trees/outline-len-of.js';
import { buildPair } from '../morph/segment-tree/match-seg-trees/build-pair.js';
import { scoreOf } from '../morph/segment-tree/match-seg-trees/score-of.js';
import { cheapChildCost } from '../morph/segment-tree/match-seg-trees/cheap-child-cost.js';


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
        outlineLenOf(a.pair.routeA),
        outlineLenOf(b.pair.routeB),
        weights, weights.sway*aniso,
        a.child, b.child
    );
    const dropCost = price.deleteCost + price.insertCost;

    const sameParent = a.pair === b.pair;

    // the best sub-pair's routes (tip → junction)
    const { routeA, routeB } = price.sub;
    const align = alignOfRoutes(routeA, routeB, unitA, unitB, weights, false);

    const verdict =
        (price.matchCost < dropCost
            ? `match (relabel ${price.matchCost.toFixed(3)} < ` +
                `drop ${dropCost.toFixed(3)})`
            : `drop (relabel ${price.matchCost.toFixed(3)} >= ` +
                `drop ${dropCost.toFixed(3)})`) +
        (!sameParent
            ? ' - HYPOTHETICAL: pooled on different parent pairs, ' +
                'the DP never compares them'
            : ' (in isolation; sequence order can override)');

    return { a, b, sameParent, price, align, verdict, root };
}


/** One child pair priced by the matcher's actual economics. */
interface ChildPairPrice {
    readonly positionCost: number;
    readonly angleCost: number;
    /** the best sub-pair's own (route-pair) shape cost */
    readonly subShapeCost: number;
    /** the best sub-pair's routes' measured warp sway */
    readonly subSwayCost: number;
    /** the best sub-pair's recursive child costs (matched + dropped) */
    readonly subChildCost: number;
    /** the best sub-pair's score = shape + children + sway (`scoreOf`) */
    readonly subCost: number;
    /** position + angle + sub (the DP's relabel price) */
    readonly matchCost: number;
    readonly deleteCost: number;
    readonly insertCost: number;
    /** the best fully built sub-pair (its routes run tip → junction) */
    readonly sub: SegMatchedPair;
}


/**
 * Prices one child pair exactly as the matcher's `matchCost` / `delCost` /
 * `insCost` would (fresh, unmemoized) - the authoritative relabel-vs-drop
 * economics for the pair. Outline lengths are those of the PARENT routes
 * the children are pooled on (position is an outline fraction).
 */
function priceChildPair(
        gA: Segment[],
        gB: Segment[],
        unitA: number,
        unitB: number,
        outlineLenA: number,
        outlineLenB: number,
        weights: PathCostWeights,
        sway: number,
        a: SegChild,
        b: SegChild): ChildPairPrice {

    const { evalBest } = buildPair(
        cheapChildCost(unitA, unitB, weights),
        gA, gB, unitA, unitB, weights, sway
    );
    const sub = evalBest(a, b);
    const { shapeCost, cost, sway: subSway } = sub;
    const subCost = scoreOf(sub);

    const positionCost = calcChildPosCost(unitA, unitB, weights)(
        a, b, outlineLenA, outlineLenB);
    const angleCost = calcAngleCost(weights)(a, b);
    const matchCost = positionCost + angleCost + subCost;
    const calcDropCost_ = calcDropCost(weights);

    return {
        positionCost,
        angleCost,
        subShapeCost: shapeCost,
        subSwayCost: subSway,
        subChildCost: cost - shapeCost,
        subCost,
        matchCost,
        deleteCost: calcDropCost_(a),
        insertCost: calcDropCost_(b),
        sub
    };
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
