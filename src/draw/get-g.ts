
/** The svg's (first) drawing group. */
function getG(svg: Element): SVGGElement;
function getG(svg: Element | null | undefined): SVGGElement | undefined;
function getG(svg: Element | null | undefined): SVGGElement | undefined {
    return svg?.getElementsByTagName('g')[0];
}


export { getG }
