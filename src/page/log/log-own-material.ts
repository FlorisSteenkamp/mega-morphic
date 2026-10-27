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
import { ownAreaOf$, flatten, calcPolygonArea } from '../../morph/segment-tree/own-area-of.js';
import { sum } from '../../utils/sum.js';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { XMLNS } from '../../draw/xmlns.js';
import { getMatchColor } from '../events/match-colors.js';
import { distToPss, svgGroup } from './align-viz.js';


/** tags the tool's drawing, for removal on the next click */
const CLASS = 'own-material';

/** makes the disk masks' ids unique */
let maskCount = 0;

/** sides of the polygon a disk is clipped with (areas inside several disks) */
const DISK_SIDES = 256;


/**
 * A matched pair a segment's owner hangs below, with the junction disk its
 * own material is measured outside of (`undefined` for the trunk).
 */
interface Ancestor {
    readonly color: string;
    readonly group: PairInTree;
    readonly disk: Circle | undefined;
}


/**
 * What a segment's material belongs to in the last match: a matched pair's
 * route or a deleted / inserted child - with the color the match and morph
 * views give it, the junction disk its material is measured outside of
 * (`ownAreaOf$`), and the pairs it hangs below.
 */
interface Owner {
    readonly color: string;
    /** `undefined` for the trunk */
    readonly disk: Circle | undefined;
    /** the matched pair, or the deleted / inserted child */
    readonly group: PairInTree | SegChild;
    /**
     * the pairs the owner hangs below, nearest first - the segment's part
     * inside the junction disk is theirs (`calcShares`)
     */
    readonly ancestors: readonly Ancestor[];
}


/**
 * The part of a segment's region one group owns: inside every disk of
 * `inside`, outside `outside` (if any).
 */
interface Share {
    readonly color: string;
    readonly group: PairInTree | SegChild;
    readonly inside: readonly Circle[];
    readonly outside: Circle | undefined;
}


/**
 * Click tool showing the material the matcher counts for each branch of the
 * last match (the morph button's): a child's material outside its junction
 * disk (`ownAreaOf$`), filled in the match view's color - red / green for
 * deleted / inserted children; its part inside the disk is its parent's,
 * filled in the parent's color - and of that, the part inside the parent's
 * own junction disk is the grandparent's, and so on up (`calcShares`).
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
 * disk, and its shares of its descendants' inside theirs (`calcShares`).
 */
function drawBranch(
        g: SVGGElement,
        owners: Map<Segment, Owner>,
        group: PairInTree | SegChild,
        color: string,
        delay: number): void {

    for (const [seg, owner] of owners) {
        for (const share of calcShares(owner)) {
            if (share.group === group) { drawRegion(g, seg, color, share, delay); }
        }
        if (owner.group === group) { drawSkeleton(g, seg, color, delay); }
    }
}


/**
 * Returns the parts of a segment's region each group owns:
 *
 * * the owner: the part outside its junction disk
 *
 * * the pair it hangs off: the part inside that disk, outside the pair's own
 *   junction disk - the part inside both is the next pair's up, and so on
 *   (e.g. a grandchild at a fork joined to its grandparent's junction by a
 *   connector: its part inside the junction is the grandparent's, not its
 *   parent's)
 *
 * * the pairs further up get nothing once the disks no longer overlap
 */
function calcShares(owner: Owner): Share[] {
    const { color, group, disk, ancestors } = owner;

    const shares: Share[] = [{ color, group, inside: [], outside: disk }];
    const inside: Circle[] = [];
    let d = disk;
    for (const a of ancestors) {
        if (d === undefined) { break; }
        const last = inside.at(-1);
        if (last !== undefined && !isOverlapping(last, d)) { break; }

        inside.push(d);
        shares.push({
            color: a.color, group: a.group, inside: [...inside], outside: a.disk
        });
        d = a.disk;
    }

    return shares;
}


/** Returns `true` if the two disks overlap. */
function isOverlapping(
        c1: Circle,
        c2: Circle): boolean {

    const { center: [x1, y1], radius: r1 } = c1;
    const { center: [x2, y2], radius: r2 } = c2;

    return Math.hypot(x2 - x1, y2 - y1) < r1 + r2;
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
        const parent = parentOf.get(mp);
        const ancestorsA = calcAncestors(parentOf, parent, 'a');
        const ancestorsB = calcAncestors(parentOf, parent, 'b');
        for (const { seg } of mp.routeA) {
            ownersA.set(seg, { color, disk: attachA, group: pair, ancestors: ancestorsA });
        }
        for (const { seg } of mp.routeB) {
            ownersB.set(seg, { color, disk: attachB, group: pair, ancestors: ancestorsB });
        }
    }

    for (const pair of pairs) {
        const ancestorsA = calcAncestors(parentOf, pair, 'a');
        const ancestorsB = calcAncestors(parentOf, pair, 'b');
        for (const op of pair.mp.ops) {
            if (op.type === 'delete') { setUnowned(ownersA, op.a, 'red', ancestorsA); }
            if (op.type === 'insert') { setUnowned(ownersB, op.b, 'green', ancestorsB); }
        }
    }

    return [ownersA, ownersB];
}


/** Returns the pair's color in the match and morph views. */
function colorOf(pair: PairInTree): string {
    return getMatchColor(pair.idx);
}


/**
 * Returns the pair and the pairs above it (nearest first), each with its
 * junction disk in the glyph of `side` - none for `undefined`.
 *
 * @param parentOf each matched sub-pair's parent pair
 * @param pair the nearest pair
 * @param side the glyph
 */
function calcAncestors(
        parentOf: Map<SegMatchedPair, PairInTree>,
        pair: PairInTree | undefined,
        side: 'a' | 'b'): Ancestor[] {

    const ancestors: Ancestor[] = [];
    for (let p = pair; p !== undefined; p = parentOf.get(p.mp)) {
        const { attachA, attachB } = p;
        ancestors.push({
            color: colorOf(p),
            group: p,
            disk: side === 'a' ? attachA : attachB
        });
    }

    return ancestors;
}


/**
 * Gives a deleted / inserted child's segments no route owns to the child.
 */
function setUnowned(
        owners: Map<Segment, Owner>,
        child: SegChild,
        color: string,
        ancestors: Ancestor[]): void {

    for (const seg of child.segs) {
        if (owners.has(seg)) { continue; }
        owners.set(seg, { color, disk: child.attachV, group: child, ancestors });
    }
}


/**
 * Draws a segment's material as the full tree shows it: each group's share
 * of its region (`calcShares`) in the group's color (`fallback` with no
 * owner, unclipped).
 */
function drawOwned(
        g: SVGGElement,
        seg: Segment,
        owner: Owner | undefined,
        fallback: string,
        delay: number): void {

    if (owner === undefined) {
        drawRegion(g, seg, fallback, NO_CLIP, delay);
        drawSkeleton(g, seg, fallback, delay);
        return;
    }

    for (const share of calcShares(owner)) {
        drawRegion(g, seg, share.color, share, delay);
    }
    drawSkeleton(g, seg, owner.color, delay);
}


/** a share's clip that leaves the region whole */
const NO_CLIP: Pick<Share, 'inside' | 'outside'> = { inside: [], outside: undefined };


/**
 * Draws the part of a segment's region inside every disk of the share's
 * `inside` and outside its `outside`, filled in the color - each disk masks
 * a group of its own, nested, so the masks multiply.
 */
function drawRegion(
        g: SVGGElement,
        seg: Segment,
        color: string,
        clip: Pick<Share, 'inside' | 'outside'>,
        delay: number): void {

    const { vertS, vertE, sleeves, caps } = geomOf$(seg);
    const loop = segmentLoop(vertS, vertE, sleeves, caps);
    if (loop.length === 0) { return; }

    const { inside, outside } = clip;
    const masks = [
        ...inside.map(disk => addDiskMask(g, disk, 'inside', delay)),
        ...(outside !== undefined ? [addDiskMask(g, outside, 'outside', delay)] : [])
    ];

    let $g = g;
    for (const maskId of masks) {
        const $masked = document.createElementNS(XMLNS, 'g');
        $masked.setAttributeNS(null, 'class', CLASS);
        $masked.setAttributeNS(null, 'mask', `url(#${maskId})`);
        $g.appendChild($masked);
        if (delay) { setTimeout(() => $masked.remove(), delay); }
        $g = $masked;
    }

    drawBeziersAsSinglePath($g, loop, `thin5 ${color} fill25 ${CLASS}`, delay);
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
    for (const [seg, owner] of owners) {
        for (const { group: g, inside, outside } of calcShares(owner)) {
            if (g !== group) { continue; }

            own += calcAreaIn(seg, inside) - (outside === undefined
                ? 0
                : calcAreaIn(seg, [...inside, outside]));
        }
    }

    return `${(100*own/total).toFixed(2)}%`;
}


/**
 * Returns the area of the segment's region inside every one of the disks
 * (all of it with none).
 *
 * * one disk: exactly (`ownAreaOf$`)
 *
 * * more: on the flattened region, clipped by each disk's inscribed
 *   polygon (`DISK_SIDES`)
 */
function calcAreaIn(
        seg: Segment,
        disks: readonly Circle[]): number {

    const { vertS, vertE, sleeves, caps, material } = geomOf$(seg);
    if (disks.length === 0) { return material; }
    if (disks.length === 1) { return material - ownAreaOf$(seg, disks[0]); }

    const loop = segmentLoop(vertS, vertE, sleeves, caps);
    if (loop.length === 0) { return 0; }

    let ps = flatten(loop);
    for (const disk of disks) {
        ps = clipToDisk(ps, disk);
        if (ps.length < 3) { return 0; }
    }

    return Math.abs(calcPolygonArea(ps));
}


/**
 * Returns the polygon clipped to the disk's inscribed polygon
 * (Sutherland-Hodgman - the clip polygon is convex).
 */
function clipToDisk(
        ps: number[][],
        disk: Circle): number[][] {

    const { center: [cx, cy], radius: r } = disk;

    // anticlockwise, so the disk's inside is left of each edge
    let out = ps;
    for (let k = 0; k < DISK_SIDES && out.length > 0; k++) {
        const θ0 = 2*Math.PI*k/DISK_SIDES;
        const θ1 = 2*Math.PI*(k + 1)/DISK_SIDES;
        const a = [cx + r*Math.cos(θ0), cy + r*Math.sin(θ0)];
        const b = [cx + r*Math.cos(θ1), cy + r*Math.sin(θ1)];

        out = clipToHalfPlane(out, a, b);
    }

    return out;
}


/**
 * Returns the polygon clipped to the half-plane left of the line `a` → `b`.
 */
function clipToHalfPlane(
        ps: number[][],
        a: number[],
        b: number[]): number[][] {

    const out: number[][] = [];
    for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const q = ps[(i + 1) % ps.length];
        const sp = calcLeftness(a, b, p);
        const sq = calcLeftness(a, b, q);

        if (sp >= 0) { out.push(p); }
        if ((sp >= 0) !== (sq >= 0)) {
            const t = sp/(sp - sq);
            out.push([p[0] + t*(q[0] - p[0]), p[1] + t*(q[1] - p[1])]);
        }
    }

    return out;
}


/**
 * Returns how far left of the line `a` → `b` the point `p` is (times the
 * line's length; negative on the right).
 */
function calcLeftness(
        a: number[],
        b: number[],
        p: number[]): number {

    const [ax, ay] = a;
    const [x, y] = p;

    return (b[0] - ax)*(y - ay) - (b[1] - ay)*(x - ax);
}


export { logOwnMaterial }
