import {
    getShapeArea, getShapeCentroid,
    get2ndMomentOfInertia, getProdMomentOfInertia
} from 'flo-boolean';


/** A coarse similarity-transform pose of a single Jordan-loop shape. */
interface Pose {
    /** area centroid — subtract to move the shape to the origin */
    readonly centroid: number[];
    /** uniform scale factor (√area) */
    readonly scale: number;
    /** principal-axis angle in radians; only defined mod π */
    readonly angle: number;
    /** |c₂₀|/(Ixx+Iyy) ∈ [0,1]: how measurable the axis is (0 = isotropic,
     *  angle is pure noise) */
    readonly anisotropy: number;
}


/**
 * Coarse, moment-based pose of a single Jordan-loop shape, used to normalize
 * two shapes to a common frame before morphing.
 *
 * The axis angle is arg(c₂₀)/2 with c₂₀ = (Iyy−Ixx) + 2i·Ixy — the same
 * principal axis as the eigen decomposition, but CONTINUOUS through
 * isotropy (no discrete major/minor label swap; the phase just moves fast
 * near c₂₀ = 0). Still only defined mod π.
 */
function procrustes(
        bezierLoop: (number[][])[]): Pose {

    const centroid = getShapeCentroid(bezierLoop);
    // getShapeArea is signed (negative for clockwise loops); use magnitude.
    const scale = Math.sqrt(Math.abs(getShapeArea(bezierLoop)));

    // Moments are only meaningful about the centroid.
    const centered = bezierLoop.map(
        ps => ps.map(p => [p[0] - centroid[0], p[1] - centroid[1]])
    );
    const [ixx, iyy] = get2ndMomentOfInertia(centered);
    const ixy = getProdMomentOfInertia(centered);
    const angle = Math.atan2(2*ixy, iyy - ixx) / 2;
    const anisotropy =
        Math.hypot(iyy - ixx, 2*ixy) / Math.abs(ixx + iyy);

    return { centroid, scale, angle, anisotropy };
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
