declare var _debug_: Debug;
import type { Circle } from 'flo-mat';
import type { Debug } from '../../debug/debug.js';
import type { Segment } from '../../morph/segment-tree/segment.js';
import type { SegChild } from '../../morph/segment-tree/match-seg-trees/seg-child.js';
import type { PairInTree } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
import type { SegMatchedPair } from '../../morph/segment-tree/match-seg-trees/seg-matched-pair.js';
import { pairsOf } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
import { geomOf$ } from '../../morph/segment-tree/geom-of.js';
import { segmentLoop } from '../../morph/segment-tree/segment-area.js';
import { ownAreaOf$ } from '../../morph/segment-tree/own-area-of.js';
import { sum } from '../../utils/sum.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { XMLNS } from '../../draw/xmlns.js';
import { matchColors } from '../events/match-colors.js';
import { distToPss, svgGroup } from './align-viz.js';


/** tags the tool's drawing, for removal on the next click */
const CLASS = 'own-material';

/** makes the disk masks' ids unique */
let maskCount = 0;


/**
 * What a segment's material belongs to in the last match: a matched pair's
 * route or a deleted / inserted child - with the color the match and morph
 * views give it, and the junction disk its material is measured outside of
 * (`ownAreaOf$`).
 */
interface Owner {
    readonly color: string;
    /** `undefined` for the trunk */
    readonly disk: Circle | undefined;
    /** the matched pair, or the deleted / inserted child */
    readonly group: PairInTree | SegChild;
    /**
     * the pair the child hangs off: the segment's part inside the junction
     * disk is its material (`undefined` for the trunk)
     */
    readonly parent: { readonly color: string; readonly group: PairInTree } | undefined;
}


/**
 * Click tool showing the material the matcher counts for each branch of the
 * last match (the morph button's): a child's material outside its junction
 * disk (`ownAreaOf$`), filled in the match view's color - red / green for
 * deleted / inserted children; its part inside the disk is its parent's,
 * filled in the parent's color.
 *
 * * `fullTree`: every branch of both glyphs
 *
 * * otherwise: the branch nearest the click and, for a matched one, its
 *   partner in the other glyph
 *
 * @param shapeIdx the clicked svg
 * @param fullTree show all branches
 */
function logOwnMaterial(
        shapeIdx: 1 | 2,
        fullTree: boolean) {

    return function(_g: SVGGElement, p: number[], showDelay?: number): void {
        if (typeof _debug_ === 'undefined') { return; }
        const pm = _debug_.elems.pathMatchResult.at(-1);
        if (pm === undefined) {
            console.log('no match yet - click morph first');
            return;
        }

        const g1 = svgGroup('svg');
        const g2 = svgGroup('svg2');
        if (g1 === undefined || g2 === undefined) { return; }
        g1.querySelectorAll(`.${CLASS}`).forEach($ => $.remove());
        g2.querySelectorAll(`.${CLASS}`).forEach($ => $.remove());

        const { gA, gB } = pm;
        const [ownersA, ownersB] = calcOwners(pairsOf(pm.trunk));
        const delay = showDelay ?? 0;

        if (fullTree) {
            for (const seg of gA) { drawOwned(g1, seg, ownersA.get(seg), 'red', delay); }
            for (const seg of gB) { drawOwned(g2, seg, ownersB.get(seg), 'green', delay); }
            return;
        }

        const tree = shapeIdx === 1 ? gA : gB;
        const owners = shapeIdx === 1 ? ownersA : ownersB;
        const seg = calcNearestSeg(tree, p);
        if (seg === undefined) { return; }
        const owner = owners.get(seg);
        if (owner === undefined) {
            console.log('the nearest segment belongs to no branch of the match');
            return;
        }

        const { group, color } = owner;
        drawBranch(g1, ownersA, group, color, delay);
        drawBranch(g2, ownersB, group, color, delay);

        const totalA = sum(gA.map(s => geomOf$(s).material));
        const totalB = sum(gB.map(s => geomOf$(s).material));
        console.log(
            `${color} branch - own material ` +
            `A ${calcFraction(ownersA, group, totalA)}, ` +
            `B ${calcFraction(ownersB, group, totalB)} (of the glyph's area)`);
    };
}


/**
 * Draws one branch's material: its segments' regions outside its junction
 * disk, and its children's inside theirs.
 */
function drawBranch(
        g: SVGGElement,
        owners: Map<Segment, Owner>,
        group: PairInTree | SegChild,
        color: string,
        delay: number): void {

    for (const [seg, owner] of owners) {
        if (owner.group === group) {
            drawRegion(g, seg, color, owner.disk, 'outside', delay);
            drawSkeleton(g, seg, color, delay);
        }
        if (owner.parent?.group === group && owner.disk !== undefined) {
            drawRegion(g, seg, color, owner.disk, 'inside', delay);
        }
    }
}


/**
 * Returns each glyph's segments' owners in the match.
 *
 * * a matched pair's routes first, so a child's segments its sub-pair's
 *   routes don't cover are left to the sub-pair's deleted / inserted
 *   children
 *
 * @param pairs the match's pairs (`pairsOf`)
 */
function calcOwners(
        pairs: PairInTree[]): [Map<Segment, Owner>, Map<Segment, Owner>] {

    const ownersA = new Map<Segment, Owner>();
    const ownersB = new Map<Segment, Owner>();

    // each matched sub-pair's parent pair
    const parentOf = new Map<SegMatchedPair, PairInTree>();
    for (const pair of pairs) {
        for (const op of pair.mp.ops) {
            if (op.type === 'match') { parentOf.set(op.sub, pair); }
        }
    }

    for (const pair of pairs) {
        const { mp, attachA, attachB } = pair;
        const color = colorOf(pair);
        const parent = calcParent(parentOf.get(mp));
        for (const { seg } of mp.routeA) {
            ownersA.set(seg, { color, disk: attachA, group: pair, parent });
        }
        for (const { seg } of mp.routeB) {
            ownersB.set(seg, { color, disk: attachB, group: pair, parent });
        }
    }

    for (const pair of pairs) {
        const parent = calcParent(pair);
        for (const op of pair.mp.ops) {
            if (op.type === 'delete') { setUnowned(ownersA, op.a, 'red', parent); }
            if (op.type === 'insert') { setUnowned(ownersB, op.b, 'green', parent); }
        }
    }

    return [ownersA, ownersB];
}


/** Returns the pair's color in the match and morph views. */
function colorOf(pair: PairInTree): string {
    return matchColors[pair.idx % matchColors.length];
}


/** Returns the owner's parent for a child of the given pair. */
function calcParent(
        pair: PairInTree | undefined): Owner['parent'] {

    return pair === undefined ? undefined : { color: colorOf(pair), group: pair };
}


/**
 * Gives a deleted / inserted child's segments no route owns to the child.
 */
function setUnowned(
        owners: Map<Segment, Owner>,
        child: SegChild,
        color: string,
        parent: Owner['parent']): void {

    for (const seg of child.segs) {
        if (owners.has(seg)) { continue; }
        owners.set(seg, { color, disk: child.attachV, group: child, parent });
    }
}


/**
 * Draws a segment's material as the full tree shows it: its region outside
 * its owner's junction disk in the owner's color and inside it in the
 * parent's (`fallback` with no owner, unclipped).
 */
function drawOwned(
        g: SVGGElement,
        seg: Segment,
        owner: Owner | undefined,
        fallback: string,
        delay: number): void {

    if (owner === undefined) {
        drawRegion(g, seg, fallback, undefined, 'outside', delay);
        drawSkeleton(g, seg, fallback, delay);
        return;
    }

    const { color, disk, parent } = owner;
    drawRegion(g, seg, color, disk, 'outside', delay);
    drawSkeleton(g, seg, color, delay);
    if (disk !== undefined && parent !== undefined) {
        drawRegion(g, seg, parent.color, disk, 'inside', delay);
    }
}


/**
 * Draws the part of a segment's region outside or inside the disk (all of
 * it with no disk), filled in the color.
 */
function drawRegion(
        g: SVGGElement,
        seg: Segment,
        color: string,
        disk: Circle | undefined,
        part: 'outside' | 'inside',
        delay: number): void {

    const { vertS, vertE, sleeves, caps } = geomOf$(seg);
    const loop = segmentLoop(vertS, vertE, sleeves, caps);

    const [$region] = drawBeziersAsSinglePath(
        g, loop, `thin5 ${color} fill25 ${CLASS}`, delay);
    if ($region === undefined || disk === undefined) { return; }

    const maskId = addDiskMask(g, disk, part, delay);
    $region.setAttributeNS(null, 'mask', `url(#${maskId})`);
}


/** Draws a segment's skeleton in the color. */
function drawSkeleton(
        g: SVGGElement,
        seg: Segment,
        color: string,
        delay: number): void {

    drawBeziersAsSinglePath(
        g, geomOf$(seg).skelPss, `thin5 ${color} nofill ${CLASS}`, delay);
}


/**
 * Adds a mask showing only the part outside or inside the disk to the
 * group and returns its id.
 */
function addDiskMask(
        g: SVGGElement,
        disk: Circle,
        part: 'outside' | 'inside',
        delay: number): string {

    const id = `${CLASS}-mask-${maskCount++}`;
    const { center: [cx, cy], radius } = disk;
    const isOutside = part === 'outside';

    const $mask = document.createElementNS(XMLNS, 'mask');
    $mask.setAttributeNS(null, 'id', id);
    $mask.setAttributeNS(null, 'class', CLASS);
    $mask.setAttributeNS(null, 'maskUnits', 'userSpaceOnUse');
    setAttrs($mask, { x: -1e5, y: -1e5, width: 2e5, height: 2e5 });

    const $rect = document.createElementNS(XMLNS, 'rect');
    setAttrs($rect, { x: -1e5, y: -1e5, width: 2e5, height: 2e5 });
    $rect.setAttributeNS(null, 'fill', isOutside ? 'white' : 'black');

    const $disk = document.createElementNS(XMLNS, 'circle');
    setAttrs($disk, { cx, cy, r: radius });
    $disk.setAttributeNS(null, 'fill', isOutside ? 'black' : 'white');

    $mask.append($rect, $disk);
    g.appendChild($mask);

    if (delay) { setTimeout(() => $mask.remove(), delay); }

    return id;
}


/** Sets the element's numeric attributes. */
function setAttrs(
        $el: Element,
        attrs: Record<string, number>): void {

    for (const [k, v] of Object.entries(attrs)) {
        $el.setAttributeNS(null, k, `${v}`);
    }
}


/** Returns the tree's segment whose skeleton is nearest the point. */
function calcNearestSeg(
        tree: Segment[],
        p: number[]): Segment | undefined {

    let nearest: Segment | undefined;
    let bestD = Infinity;
    for (const seg of tree) {
        const d = distToPss(p, geomOf$(seg).skelPss);
        if (d < bestD) { bestD = d; nearest = seg; }
    }

    return nearest;
}


/**
 * Returns a branch's material (as `drawBranch` shows it) as a percentage
 * of the glyph's area.
 */
function calcFraction(
        owners: Map<Segment, Owner>,
        group: PairInTree | SegChild,
        total: number): string {

    let own = 0;
    for (const [seg, { group: g, disk, parent }] of owners) {
        const { material } = geomOf$(seg);
        const outside = disk === undefined ? material : ownAreaOf$(seg, disk);
        if (g === group) { own += outside; }
        if (parent?.group === group) { own += material - outside; }
    }

    return `${(100*own/total).toFixed(2)}%`;
}


export { logOwnMaterial }
