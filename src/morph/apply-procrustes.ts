import { mapmap } from '../utils/map-map.js';
import type { MorphEntry } from './morph-entry.js';
import type { PoseRamp } from './procrustes/pose-ramp.js';
import type { PoseOptions } from './procrustes/pose-options.js';
import { calcProcrustes } from './procrustes/calc-procrustes.js';
import { resolveMorphAt } from './resolve-morph-at/resolve-morph-at.js';
import { trunkOutlines } from './resolve-morph-at/trunk-outlines.js';


/**
 * Aligns shape 2's frame onto shape 1 (√area scale, centroid-to-centroid;
 * NO rotation - the intrinsic skeleton lerp already plays orientation out
 * linearly) by mapping every b-frame coordinate into the aligned frame -
 * the sleeve data is stored in local frames (chord-normalized pieces,
 * polar anchors) and radii are scaled, so the reconstruction stays exact.
 * Pure: returns NEW entries (untouched fields shared) plus the ramp
 * restoring the true pose over t (apply when drawing).
 *
 * Call AFTER `buildMorphEntries`, with the glyphs' outline loops
 * (`SegGraph.loop`).
 */
function applyProcrustes(
        loopA: number[][][],
        loopB: number[][][],
        entries: MorphEntry[],
        poseOptions: PoseOptions): {
            entries: MorphEntry[];
            poseRamp: PoseRamp
        } | undefined {

    const { applyCentroid, applyScale, trunkOnlyTisserand } = poseOptions;
    if (!(applyCentroid || applyScale)) {
        return undefined;
    }

    // Trunk-only: measure both poses from the TRUNK entry's resolved
    // outlines (t=0 = A's trunk, t=1 = B's trunk in its true frame) - side
    // branches and ins/dels stop dragging the frame, and the metric matches
    // the draw-time measurement exactly (endpoint-consistent, so no extra
    // scale re-measure is needed).
    const trunkPoseAt = (t: number) => {
        const { outlines, outlineEntry } = resolveMorphAt(entries, t);
        const loops = trunkOutlines(entries, outlines, outlineEntry);
        return loops.length > 0
            ? calcProcrustes(loops.flat())
            : undefined;
    };
    const pose1 = (trunkOnlyTisserand ? trunkPoseAt(0) : undefined)
        ?? calcProcrustes(loopA);
    const pose2 = (trunkOnlyTisserand ? trunkPoseAt(1) : undefined)
        ?? calcProcrustes(loopB);

    const s = applyScale ? pose1.scale / pose2.scale : 1;

    const centroid2 = pose2.centroid;
    const centroid1 = applyCentroid ? pose1.centroid : pose2.centroid;

    const toAlignedFrame_ = toAlignedFrame(centroid1, centroid2, s);


    // Fresh entries - untouched fields (sleeves, us, glue, a-frame) are
    // shared by reference; glue targets entries by INDEX, preserved by map.
    const alignedEntries: MorphEntry[] = entries.map(e => {
        // Deleted (side-a) topo entries live entirely in shape 1's frame.
        if (e.collapsed === 'b') {
            return e;
        }

        return {
            ...e,
            // An inserted entry's collapsed frame is in shape 2's coords too.
            ...(e.collapsed === 'a'
                ? { skelPssA: mapmap(e.skelPssA, toAlignedFrame_) }
                : {}
            ),
            skelPssB: mapmap(e.skelPssB, toAlignedFrame_),
            ...(e.rb !== undefined ? { rb: e.rb.map(r => r * s) } : {})
        };
    });


    // Whole-shape mode measures the ramp's scale endpoints in the DRAW-TIME
    // metric (seam-overcounting per-entry soup) - see calcScaleAt. Trunk
    // mode already measured pose1/pose2 in that metric.
    const calcScaleAt_ = calcScaleAt(alignedEntries);

    const s1D = applyScale && !trunkOnlyTisserand
        ? calcScaleAt_(0) ?? pose1.scale
        : pose1.scale;
    const s2D = applyScale && !trunkOnlyTisserand
        ? (calcScaleAt_(1) ?? pose1.scale) / s
        : pose2.scale;

    const poseRamp: PoseRamp = {
        c1: pose1.centroid,
        c2: pose2.centroid,
        s1: s1D,
        s2: s2D
    };

    return {
        entries: alignedEntries,
        poseRamp
    };
}


function toAlignedFrame(
        centroid1: number[], centroid2: number[],
        scale: number) {

    const [c1x, c1y] = centroid1;
    const [c2x, c2y] = centroid2;

    return function([x, y]: number[]): number[] {
        return [
            c1x + scale*(x - c2x),
            c1y + scale*(y - c2y)
        ];
    }
}


// Ramp scale endpoints in the DRAW-TIME metric: the live measurement
// (procrustes over the per-entry outlines) overcounts seam overlaps vs
// the true single-loop area, so true-loop endpoints would shrink the
// drawn glyph at every t. Measure t=0/1 exactly as the draw loop does;
// the t=1 sample (aligned B, at A's size) is un-aligned back to B's
// true size. The overcount bias then cancels at the endpoints exactly
// and approximately in between.
function calcScaleAt(
        entries: MorphEntry[]) {

    return function(t: number): number | undefined {
        const { outlines } = resolveMorphAt(entries, t);

        return outlines.length > 0
            ? calcProcrustes(outlines.flat()).scale
            : undefined;
    }
}


export { applyProcrustes }
