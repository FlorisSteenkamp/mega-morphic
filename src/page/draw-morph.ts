import type { PageData } from "./page-data";
import { drawBeziersAsSinglePath } from "../draw/draw-beziers-as-single-path";


/** Interpolate every morph drawable at `t` ∈ [0,1] and draw. */
function drawMorph(
        refPageData: React.RefObject<PageData | null>,
        t: number) {

    const { morphRef, svgRef3 } = refPageData.current!;

    const entries = morphRef.current;
    if (!entries) { return; }

    const g3 = svgRef3.current!.getElementsByTagName('g')[0];
    g3.replaceChildren();

    for (const { a, b, classes } of entries) {
        const beziers = a.map((ps, k) =>
            ps.map((p, j) => p.map((c, d) =>
                c * (1 - t) + b[k][j][d] * t)));

        drawBeziersAsSinglePath(g3, beziers, classes);
    }
}


export { drawMorph }
