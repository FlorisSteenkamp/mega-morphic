import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { PathAlignDebug } from '../morph/match-paths/path-align-debug.js';
import type { Segment } from '../morph/segment-tree/segment.js';
import type { SegMatchedPair } from '../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import type { SegOp } from '../morph/segment-tree/match-seg-trees/seg-op.js';
import type { SegChild } from '../morph/segment-tree/match-seg-trees/seg-child.js';
import type { RouteWarp } from '../morph/segment-tree/match-seg-trees/route-warp-of.js';
import type { RouteFeatures } from '../morph/segment-tree/match-seg-trees/route-features-of.js';
import { calcWarpPosCost, calcAngleCost, calcSizeFactor, calcDropCost } from '../morph/segment-tree/match-seg-trees/child-costs.js';
import { alignOfRoutes } from './align-of-routes.js';
import { anisoOf } from '../morph/segment-tree/match-seg-trees/aniso-of.js';
import { getUnit$ } from '../morph/segment-tree/get-unit.js';
import { lenOfRoute$, lenOfSegs$ } from '../morph/segment-tree/len-of.js';
import { TARGET_SAMPLES } from '../morph/segment-tree/match-seg-trees/consts.js';
import { routeWarpOf } from '../morph/segment-tree/match-seg-trees/route-warp-of.js';
import { routeFeaturesOf } from '../morph/segment-tree/match-seg-trees/route-features-of.js';
import { buildPair } from '../morph/segment-tree/match-seg-trees/build-pair.js';
import { scoreOf } from '../morph/segment-tree/match-seg-trees/score-of.js';
import { cheapChildCost } from '../morph/segment-tree/match-seg-trees/cheap-child-cost.js';
import { calcSubWeights } from '../morph/segment-tree/match-seg-trees/calc-sub-weights.js';


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
    readonly outcome: {
        type: SegOp['type'];
        partner?: SegChild;
        /** the match's sub-pair (for a match) */
        sub?: SegMatchedPair;
    };
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
    /**
     * the match's own sub-pair, when the two children are matched with
     * each other - drawn instead of the priced one (`price.sub`), which a
     * staggered match may not have used
     */
    readonly actualSub?: SegMatchedPair;
    /** viz alignment of the drawn sub-pair's routes */
    readonly align?: PathAlignDebug;
    readonly verdict: string;
    /** the winning match the pair was located in */
    readonly root: SegMatchedPair;
}


/**
 * * **Debug only**
 * 
 * Prices a clicked child-segment pair with the segment matcher's actual
 * economics: the segments are located as pooled children of the winning
 * match (`root` - the morph's, staggered or not), then the pair is priced
 * exactly as the matcher's relabel-vs-drop decision would price it (current
 * weights).
 */
function evalChildPair(
        gA: Segment[],
        gB: Segment[],
        root: SegMatchedPair,
        segA: Segment,
        segB: Segment,
        loopA: number[][][],
        loopB: number[][][],
        weights: PathCostWeights): ChildPairEval {

    const unitA = getUnit$(loopA);
    const unitB = getUnit$(loopB);
    const aniso = anisoOf(loopA, loopB);

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

    // the parent routes' correspondence and features (every child of a
    // pair appears in its ops: matched, deleted or inserted)
    const { pair: pairA } = a;
    const { pair: pairB } = b;
    const childrenA = pairA.ops.flatMap(op => op.type !== 'insert' ? [op.a] : []);
    const childrenB = pairB.ops.flatMap(op => op.type !== 'delete' ? [op.b] : []);
    const price = priceChildPair(
        gA, gB, unitA, unitB,
        routeWarpOf(pairA.routeA, pairB.routeB, unitA, unitB),
        routeFeaturesOf(childrenA, lenOfRoute$(pairA.routeA)),
        routeFeaturesOf(childrenB, lenOfRoute$(pairB.routeB)),
        weights, weights.sway*aniso,
        a.child, b.child
    );
    const dropCost = price.deleteCost + price.insertCost;

    const sameParent = a.pair === b.pair;

    // the drawn sub-pair: the match's own when the two are matched with
    // each other (in a staggered match a pair kept from the coarse match
    // keeps its coarse sub-routes, which the free pricing may not pick),
    // else the priced best one - routes tip → junction
    const { outcome } = a;
    const actualSub = outcome.type === 'match' && outcome.partner === b.child
        ? outcome.sub
        : undefined;
    const { routeA, routeB } = actualSub ?? price.sub;
    // aligned as the matcher aligned them: a child pair's weights
    const align = alignOfRoutes(
        routeA, routeB, unitA, unitB,
        lenOfSegs$(gA)/TARGET_SAMPLES, lenOfSegs$(gB)/TARGET_SAMPLES,
        calcSubWeights(weights, a.child, b.child), weights.sway*aniso,
        a.child.routeDir - b.child.routeDir, true);

    const verdict =
        (price.matchCost < dropCost
            ? `match (relabel ${price.matchCost.toFixed(3)} < ` +
                `drop ${dropCost.toFixed(3)})`
            : `drop (relabel ${price.matchCost.toFixed(3)} >= ` +
                `drop ${dropCost.toFixed(3)})`) +
        (!sameParent
            ? ' - HYPOTHETICAL: pooled on different parent pairs, ' +
                'the DP never compares them'
            : ' (in isolation; the order of the other matches around ' +
                'the outlines can override)');

    return {
        a, b, sameParent, price, verdict, root,
        ...(align !== undefined ? { align } : {}),
        ...(actualSub !== undefined ? { actualSub } : {})
    };
}


/** One child pair priced by the matcher's actual economics. */
interface ChildPairPrice {
    /**
     * position price through the parent routes' correspondence, in feature
     * intervals (`calcWarpPosCost`), scaled by the pair's size factor
     */
    readonly positionCost: number;
    /** angle price, scaled by the pair's size factor */
    readonly angleCost: number;
    /** the pair's size factor (`calcSizeFactor`) */
    readonly sizeFactor: number;
    /** the best sub-pair's own (route-pair) shape cost */
    readonly subShapeCost: number;
    /** the best sub-pair's routes' measured warp sway, times the size factor */
    readonly subSwayCost: number;
    /** the best sub-pair's recursive child costs (matched, incl. their
     *  sway, + dropped) */
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
 * economics for the pair. The warp and features are those of the PARENT
 * routes the children are pooled on.
 */
function priceChildPair(
        gA: Segment[],
        gB: Segment[],
        unitA: number,
        unitB: number,
        warp: RouteWarp,
        featsA: RouteFeatures,
        featsB: RouteFeatures,
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

    const sizeFactor = calcSizeFactor(weights)(a, b);
    const positionCost = sizeFactor*calcWarpPosCost(weights)(
        a, b, warp, featsA, featsB);
    const angleCost = sizeFactor*calcAngleCost(weights)(a, b);
    const matchCost = positionCost + angleCost + subCost;
    const calcDropCost_ = calcDropCost(weights);

    return {
        positionCost,
        angleCost,
        sizeFactor,
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
                            partner: key === 'a' ? op.b : op.a,
                            sub: op.sub }
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
