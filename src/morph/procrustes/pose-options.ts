
/** Which pose components are aligned/pinned (procrustes split). */
interface PoseOptions {
    readonly applyCentroid: boolean;
    readonly applyScale: boolean;
    /** measure the pose (centroid/scale/axis, build + draw time) from the
     *  TRUNK entry's outlines only - side branches and ins/dels stop
     *  dragging the frame */
    readonly trunkOnlyTisserand: boolean;
}


export { PoseOptions }
