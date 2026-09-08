import type { ToDraw } from './to-draw.js';
import type { DeducedState } from './deduced-state.js';


type ClickFor = 
    | 'bezier_'
    | 'twoProng'
    | 'threeProng'
    | 'bezier'
    | 'container'
    | 'loopSimplified'
    | 'loopset'
    | 'cp'
    | 'curvature'
    | 'branch'
    | 'curve'
    | 'matCurve'
    | 'salience'
    | 'roundSalience'
    // | 'speed'


interface PageState {
    /** Won't be save to localstorage */
    readonly deduced: DeducedState;
    readonly glyph1Name: string;
    readonly glyph2Name: string;
    readonly viewbox1: number[][];
    readonly viewbox2: number[][];
    readonly showDelay: number;
    readonly clickFor : ClickFor;
    readonly satScale: number;
    readonly toDraw: ToDraw;
    readonly viewMat: boolean;
    readonly simplify: boolean;
    /** Which of the three SVGs are shown (shape 1, shape 2, morph). */
    readonly showSvgs: readonly [boolean, boolean, boolean];
}



export { PageState, ClickFor }
