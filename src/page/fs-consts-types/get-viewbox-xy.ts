
function getViewboxXY(
        svg$: SVGSVGElement,
        clientX: number,
        clientY: number): number[] {

    // Use the SVG's own screen transform so letterboxing (from
    // preserveAspectRatio), borders and scrolling are all accounted for.
    const ctm = svg$.getScreenCTM();
    if (!ctm) { return [0, 0]; }

    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());

    return [p.x, p.y];
}


export { getViewboxXY }
