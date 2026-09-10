import { SideResidual } from "./side-residual";


/** The boundary residuals at one skeleton sample point. */
interface ResidualSample {
    /** skeleton edge index (into the branch's skeleton path) */
    readonly edge: number;
    /** arc-length fraction within the edge */
    readonly f: number;
    /** outbound boundary side (walked tip → end) */
    readonly out: SideResidual;
    /** return boundary side (walked end → tip) */
    readonly back: SideResidual;
}


export { ResidualSample }
