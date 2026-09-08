import { getLargestVertex, Mat } from "flo-mat";
import { getShapeArea, getShapeCentroid, getPrincipalAxes } from 'flo-boolean';
import { getBranchTree } from "./branch-tree/get-branch-tree.js";


/** A coarse similarity-transform pose of a single Jordan-loop shape. */
interface Pose {
    /** area centroid — subtract to move the shape to the origin */
    readonly centroid: number[];
    /** uniform scale factor (√area) */
    readonly scale: number;
    /** principal-axis angle in radians; only defined mod π */
    readonly angle: number;
}


/**
 * Coarse, moment-based pose of a single Jordan-loop shape, used to normalize
 * two shapes to a common frame before morphing.
 *
 * Rotation is the shape's principal axis and is only defined mod π; the 180°
 * / reflection ambiguity is left for the finer, correspondence-based step.
 */
function procrustes(
        bezierLoop: (number[][])[],
        mats: Mat[]): Pose {

    // Kept for the upcoming correspondence-based (fine) step.
    const cpNode = getLargestVertex(mats[0].cpNode);
    const tree = getBranchTree(cpNode);

    const centroid = getShapeCentroid(bezierLoop);
    // getShapeArea is signed (negative for clockwise loops); use magnitude.
    const scale = Math.sqrt(Math.abs(getShapeArea(bezierLoop)));

    // Principal axes are only meaningful about the centroid.
    const centered = bezierLoop.map(
        ps => ps.map(p => [p[0] - centroid[0], p[1] - centroid[1]])
    );
    const { eigenVectors } = getPrincipalAxes(centered);
    const [vx, vy] = eigenVectors[0];
    const angle = Math.atan2(vy, vx);

    return { centroid, scale, angle };
}


/** A 2-D similarity transform: uniform scale, rotation, then translation. */
interface Similarity {
    readonly scale: number;
    /** in radians */
    readonly rot: number;
    readonly tx: number;
    readonly ty: number;
}


/**
 * The similarity that maps points in the `from` shape's frame into the `to`
 * shape's frame (centroid-to-centroid, scale-matched, principal-axes aligned).
 *
 * Because principal axes are only defined mod π, pass `flip = true` to add the
 * 180° alternative; callers pick whichever gives the better correspondence.
 */
function alignSimilarity(from: Pose, to: Pose, flip = false): Similarity {
    const scale = to.scale / from.scale;
    const rot = (to.angle - from.angle) + (flip ? Math.PI : 0);

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // p' = to.centroid + scale · R(rot) · (p − from.centroid)
    const tx = to.centroid[0] - scale * (cos * from.centroid[0] - sin * from.centroid[1]);
    const ty = to.centroid[1] - scale * (sin * from.centroid[0] + cos * from.centroid[1]);

    return { scale, rot, tx, ty };
}


/** Applies a similarity transform to a point. */
function applySimilarity(t: Similarity, p: number[]): number[] {
    const cos = Math.cos(t.rot);
    const sin = Math.sin(t.rot);

    return [
        t.scale * (cos * p[0] - sin * p[1]) + t.tx,
        t.scale * (sin * p[0] + cos * p[1]) + t.ty,
    ];
}


export { procrustes, alignSimilarity, applySimilarity }
export type { Pose, Similarity }
