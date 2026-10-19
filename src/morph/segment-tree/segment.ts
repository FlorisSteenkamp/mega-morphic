import type { CpNode } from 'flo-mat';


declare const segmentStart: unique symbol;

/**
 * A fork-to-fork/leaf skeleton stretch - no forks in its interior.
 *
 * A segment IS the contact point its MAT walk starts from: the outline
 * steps `cp` → `cp.next` from there, through the pass-through disks, up to
 * the next fork/leaf disk. Everything else about it - its end vertices,
 * skeleton, radii, sleeves and area - is what that walk yields: `geomOf$`.
 *
 * * branded so only a segment START type-checks as a `Segment` (any other
 *   contact point is just a `CpNode`); `segTreeFromCp` applies the brand
 *
 * A shape's segment tree is simply its `Segment[]` - the skeleton cut at
 * every fork:
 *
 * * vertices = forks + leaf tips = the MAT's maximal-disk circles there,
 *   implicit as the segments' end vertices (`vertS`/`vertE`) and compared
 *   by identity (flo-mat shares one `Circle` object per MAT vertex),
 * * segments = the stretches between.
 *
 * * **no** segment crosses a fork, so any leaf-to-leaf path decomposes into
 *   whole segments
 */
type Segment = CpNode & { readonly [segmentStart]: true };


/**
 * One step of a route: a whole tree segment, walked v0→v1 or reversed.
 */
interface RouteStep {
    readonly seg: Segment;
    readonly reversed: boolean;
}


export { Segment, RouteStep }
