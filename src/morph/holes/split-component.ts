import type { Mat, MatOptions } from 'flo-mat';
import { findMats } from 'flo-mat';
import { prepareStaggered } from '../staggered-sat.js';
import { getComponentLoops } from './get-component-loops.js';


/** A MAT, with its coarse SAT when staggered. */
interface StaggeredMat {
    readonly mat: Mat;
    /** its coarse SAT (`prepareStaggered`) - `undefined`: not staggered */
    readonly coarse: Mat | undefined;
}


/**
 * A component (MAT) with its holes split off: the component with its holes
 * filled, and each hole as a shape of its own.
 */
interface SplitComponent {
    /** the MAT of the component's outer loop alone */
    readonly filled: StaggeredMat;
    /**
     * the MAT of each hole's loop as a shape, in `getComponentLoops`' order
     * (empty: the component has no holes - `filled` is then the component)
     */
    readonly holes: StaggeredMat[];
}


/**
 * Returns the component with its holes split off.
 *
 * * a component without holes, or one whose filled outline or a hole yields
 *   no MAT, is returned as is (no holes)
 *
 * @param mat the component's MAT
 * @param coarse its coarse SAT (`undefined`: not staggered)
 * @param options the MAT options (as the component's)
 */
function getSplitComponent(
        mat: Mat,
        coarse: Mat | undefined,
        options: MatOptions): SplitComponent {

    const unsplit = { filled: { mat, coarse }, holes: [] };

    const { outer, holes } = getComponentLoops(mat.cpNode);
    if (holes.length === 0) { return unsplit; }

    const staggered = coarse !== undefined;
    const filled = getStaggeredMat(outer, staggered, options);
    const holeMats = holes.map(h => getStaggeredMat(h, staggered, options));
    if (filled === undefined || holeMats.some(h => h === undefined)) {
        return unsplit;
    }

    return { filled, holes: holeMats as StaggeredMat[] };
}


/**
 * Returns the MAT of a single loop (with its coarse SAT when staggered) -
 * `undefined` if it yields none.
 *
 * @param loop the loop
 * @param staggered whether to prepare its coarse SAT
 * @param options the MAT options
 */
function getStaggeredMat(
        loop: number[][][],
        staggered: boolean,
        options: MatOptions): StaggeredMat | undefined {

    const mat = findMats([loop], options)[0];
    if (mat === undefined) { return undefined; }

    return { mat, coarse: staggered ? prepareStaggered(mat) : undefined };
}


export { getSplitComponent }
export type { SplitComponent, StaggeredMat }
