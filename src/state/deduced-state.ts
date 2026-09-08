import type { Mat } from "flo-mat";


interface DeducedState {
    readonly pathStr1: string;
    readonly mats1: Mat[];
    readonly pathStr2: string;
    readonly mats2: Mat[];
    readonly bezierLoops1: number[][][][];
    readonly bezierLoops2: number[][][][];
}


export type { DeducedState }
