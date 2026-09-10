
/**
 * The offset of the true boundary from the disk-envelope contact point, in
 * the skeleton's local frame at the sample: `truth = contact(sigma) +
 * rT·T + rN·(sigma·N)` where `T` is the skeleton tangent and `N` its left
 * normal.
 */
interface SideResidual {
    /** which envelope side the boundary lies on: contact = p + r(−r′T + σ√(1−r′²)N) */
    readonly sigma: 1 | -1;
    readonly rT: number;
    readonly rN: number;
}


export { SideResidual }
