declare var _debug_: Debug;
import type { Circle } from 'flo-mat';
import type { Debug } from '../../debug/debug.js';
import type { Segment } from '../../morph/segment-tree/segment.js';
import type { SegChild } from '../../morph/segment-tree/match-seg-trees/seg-child.js';
import type { PairInTree } from '../../morph/segment-tree/match-seg-trees/pairs-of.js';
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
}


/**
 * Click tool showing the material the matcher counts for each branch of the
 * last match (the morph button's): a child's material outside its junction
 * disk (`ownAreaOf$`), filled in the match view's color - red / green for
 * deleted / inserted children.
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

        const segsA = [...ownersA].filter(([, o]) => o.group === owner.group).map(([s]) => s);
        const segsB = [...ownersB].filter(([, o]) => o.group === owner.group).map(([s]) => s);
        for (const s of segsA) { drawOwned(g1, s, ownersA.get(s), 'red', delay); }
        for (const s of segsB) { drawOwned(g2, s, ownersB.get(s), 'green', delay); }

        const totalA = sum(gA.map(s => geomOf$(s).material));
        const totalB = sum(gB.map(s => geomOf$(s).material));
        console.log(
            `${owner.color} branch - own material ` +
            `A ${calcFraction(segsA, ownersA, totalA)}, ` +
            `B ${calcFraction(segsB, ownersB, totalB)} (of the glyph's area)`);
    };
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

    for (const pair of pairs) {
        const { mp, idx, attachA, attachB } = pair;
        const color = matchColors[idx % matchColors.length];
        for (const { seg } of mp.routeA) {
            ownersA.set(seg, { color, disk: attachA, group: pair });
        }
        for (const { seg } of mp.routeB) {
            ownersB.set(seg, { color, disk: attachB, group: pair });
        }
    }

    for (const { mp } of pairs) {
        for (const op of mp.ops) {
            if (op.type === 'delete') { setUnowned(ownersA, op.a, 'red'); }
            if (op.type === 'insert') { setUnowned(ownersB, op.b, 'green'); }
        }
    }

    return [ownersA, ownersB];
}


/**
 * Gives a deleted / inserted child's segments no route owns to the child.
 */
function setUnowned(
        owners: Map<Segment, Owner>,
        child: SegChild,
        color: string): void {

    for (const seg of child.segs) {
        if (owners.has(seg)) { continue; }
        owners.set(seg, { color, disk: child.attachV, group: child });
    }
}


/**
 * Draws a segment's region outside its owner's junction disk, filled in
 * the owner's color (`fallback` with no owner, unclipped).
 */
function drawOwned(
        g: SVGGElement,
        seg: Segment,
        owner: Owner | undefined,
        fallback: string,
        delay: number): void {

    const { vertS, vertE, sleeves, skelPss } = geomOf$(seg);
    const loop = segmentLoop(vertS, vertE, sleeves);
    const color = owner?.color ?? fallback;

    const [$region] = drawBeziersAsSinglePath(
        g, loop, `thin5 ${color} fill25 ${CLASS}`, delay);
    drawBeziersAsSinglePath(g, skelPss, `thin5 ${color} nofill ${CLASS}`, delay);

    const disk = owner?.disk;
    if ($region === undefined || disk === undefined) { return; }

    $region.setAttributeNS(null, 'mask', `url(#${addDiskMask(g, disk, delay)})`);
}


/**
 * Adds a mask hiding the disk to the group and returns its id.
 */
function addDiskMask(
        g: SVGGElement,
        disk: Circle,
        delay: number): string {

    const id = `${CLASS}-mask-${maskCount++}`;
    const { center: [cx, cy], radius } = disk;

    const $mask = document.createElementNS(XMLNS, 'mask');
    $mask.setAttributeNS(null, 'id', id);
    $mask.setAttributeNS(null, 'class', CLASS);
    $mask.setAttributeNS(null, 'maskUnits', 'userSpaceOnUse');
    setAttrs($mask, { x: -1e5, y: -1e5, width: 2e5, height: 2e5 });

    const $rect = document.createElementNS(XMLNS, 'rect');
    setAttrs($rect, { x: -1e5, y: -1e5, width: 2e5, height: 2e5 });
    $rect.setAttributeNS(null, 'fill', 'white');

    const $disk = document.createElementNS(XMLNS, 'circle');
    setAttrs($disk, { cx, cy, r: radius });
    $disk.setAttributeNS(null, 'fill', 'black');

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
 * Returns the segments' material outside their owners' disks as a
 * percentage of the glyph's area.
 */
function calcFraction(
        segs: Segment[],
        owners: Map<Segment, Owner>,
        total: number): string {

    const own = sum(segs.map(s => {
        const disk = owners.get(s)?.disk;
        return disk === undefined ? geomOf$(s).material : ownAreaOf$(s, disk);
    }));

    return `${(100*own/total).toFixed(2)}%`;
}


export { logOwnMaterial }
