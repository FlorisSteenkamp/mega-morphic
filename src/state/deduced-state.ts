import type { Mat } from "flo-mat";
import type { PoseRamp } from "../morph/procrustes/pose-ramp.js";


interface DeducedState {
    readonly pathStr1: string;
    readonly mats1: Mat[];
    readonly pathStr2: string;
    readonly mats2: Mat[];
    readonly bezierLoops1: number[][][][];
    readonly bezierLoops2: number[][][][];
    /** the morph's pose-pinning ramp */
    readonly morphPose: PoseRamp;
}


export type { DeducedState }
