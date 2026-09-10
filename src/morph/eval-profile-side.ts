import { SideResidual } from "./side-residual";


/** Piecewise-linear evaluation of one profile side at position `u`. */
function evalProfileSide(
        us: number[],
        side: SideResidual[],
        u: number): SideResidual {

    if (us.length === 0) { return { sigma: 1, rT: 0, rN: 0 }; }
    if (u <= us[0]) { return side[0]; }
    if (u >= us[us.length - 1]) { return side[side.length - 1]; }

    let i = 0;
    while (i < us.length - 2 && us[i + 1] < u) { i++; }

    const span = us[i + 1] - us[i];
    const f = span <= 0 ? 0 : (u - us[i]) / span;
    const s0 = side[i];
    const s1 = side[i + 1];

    return {
        sigma: f < 0.5 ? s0.sigma : s1.sigma,
        rT: s0.rT*(1 - f) + s1.rT*f,
        rN: s0.rN*(1 - f) + s1.rN*f,
    };
}


export { evalProfileSide }
