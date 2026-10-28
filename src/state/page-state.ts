import type { ToDraw } from './to-draw.js';
import type { DeducedState } from './deduced-state.js';
import type { ClickFor } from './click-for.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { GlyphPreset } from './glyph-preset.js';


interface PageState {
    /** Won't be save to localstorage */
    readonly deduced: DeducedState;
    readonly glyph1Name: string;
    readonly glyph2Name: string;
    /** saved glyph pairs, selectable from the presets dropdown */
    readonly glyphPresets: readonly GlyphPreset[];
    readonly viewbox1: number[][];
    readonly viewbox2: number[][];
    readonly viewbox3: number[][];
    readonly showDelay: number;
    /** undefined = clicking the shapes does nothing */
    readonly clickFor: ClickFor | undefined;
    readonly satScale: number;
    readonly toDraw: ToDraw;
    readonly viewMat: boolean;
    /**
     * staggered SAT: the MATs are the fine SAT (`STAGGER_FINE`), matched
     * first at the coarse scale (`STAGGER_COARSE`) and then refined -
     * overrides `viewMat` and `satScale`
     */
    readonly staggeredSat: boolean;
    readonly simplify: boolean;
    /** Which of the three SVGs are shown (shape 1, shape 2, morph). */
    readonly showSvgs: readonly [boolean, boolean, boolean];
    /** Show the path-matching weight sliders. */
    readonly showWeights: boolean;
    /** Draw the morph as filled area only (no MAT skeletons, no outline stroke). */
    readonly morphFillOnly: boolean;
    /** fill only: fill with the morphing texture (`addMorphingFill`) instead
     *  of a solid color */
    readonly morphPattern: boolean;
    /** Draw a pose gizmo on the morph (centroid ring ∝ √area + principal
     *  axis line), measured from the drawn outlines. */
    readonly showPose: boolean;
    /** Show the last morph's match overlay on svgs 1 and 2. */
    readonly showMatch: boolean;
    /** also draw each matched piece's boundary in the pair's color */
    readonly showMatchBoundary: boolean;
    /** Show the fat trees' branch indices on svgs 1 and 2. */
    readonly showBranchNums: boolean;
    /** rotation of shape 1 (degrees, applied before the MAT) */
    readonly rot1: number;
    /** horizontal mirror of shape 1 (applied before the MAT) */
    readonly flipH: boolean;
    /** vertical mirror of shape 1 (applied before the MAT) */
    readonly flipV1: boolean;
    /** vertical mirror of shape 2 (applied before the MAT) */
    readonly flipV2: boolean;
    /** path-matching cost weights (match + morph) */
    readonly pathWeights: PathCostWeights;
    readonly morphT: number;
    /** morph playback speed: 1 = one pass, glyph 1 → glyph 2, in
     *  `MORPH_PASS_SECONDS` */
    readonly morphSpeed: number;
}



export { PageState }
