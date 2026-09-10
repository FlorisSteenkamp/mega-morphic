import { SideResidual } from "./side-residual";


/** A branch's residuals as piecewise-linear profiles over the global
 *  normalized skeleton position u ∈ [0,1] (tip → end). */
interface ResidualProfile {
    readonly us: number[];
    readonly out: SideResidual[];
    readonly back: SideResidual[];
}


export { ResidualProfile }
