import type { ToDraw } from './to-draw.js';
import type { DeducedState } from './deduced-state.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';


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
    readonly viewbox3: number[][];
    readonly showDelay: number;
    /** undefined = clicking the shapes does nothing */
    readonly clickFor: ClickFor | undefined;
    readonly satScale: number;
    readonly toDraw: ToDraw;
    readonly viewMat: boolean;
    readonly simplify: boolean;
    /** Which of the three SVGs are shown (shape 1, shape 2, morph). */
    readonly showSvgs: readonly [boolean, boolean, boolean];
    /** Draw the morph as filled area only (no MAT skeletons, no outline stroke). */
    readonly morphFillOnly: boolean;
    /** Procrustes pose alignment: morph shape in the aligned frame, ride
     *  the pose change globally. */
    readonly procrustes: boolean;
    /** Draw a pose gizmo on the morph (centroid ring ∝ √area + principal
     *  axis line), measured from the drawn outlines. */
    readonly showPose: boolean;
    /** test rotation of shape 1 (degrees, applied before the MAT) */
    readonly rot1: number;
    /** test horizontal mirror of shape 1 (applied before the MAT) */
    readonly flip1: boolean;
    /** path-matching cost weights (match + morph) */
    readonly pathWeights: PathCostWeights;
}



export { PageState, ClickFor }
