
/**
 * A coarse similarity-transform pose of a single Jordan-loop shape.
 */
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
    /** largest principal second moment of area (∫proj² along `angle`), ≥ 0 */
    readonly momMajor: number;
    /** smallest principal second moment of area (⊥ to `angle`), ≥ 0 */
    readonly momMinor: number;
}


export { Pose }
