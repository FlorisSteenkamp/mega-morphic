import { StateControl } from "../../state-control/state-control.js";
import { getViewboxXY } from "../fs-consts-types/get-viewbox-xy.js";


function mouseMove(
        stateControl: StateControl,
        svgRef: React.RefObject<SVGSVGElement | null>,
        refX: React.RefObject<HTMLSpanElement | null>,
        refY: React.RefObject<HTMLSpanElement | null>,
        shapeIdx: 1|2) {

    return (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        let svg$ = svgRef.current;
        if (!svg$) { return; }

        let { state, transientState } = stateControl;
        let { pageState } = state.appState;
        let { zoomState } = transientState;

        let [viewboxX,viewboxY] = 
            getViewboxXY(svg$, event.clientX, event.clientY);

        let spanX = refX.current;
        if (spanX) { spanX.innerHTML = viewboxX.toFixed(5); }
        let spanY = refY.current;
        if (spanY) { spanY.innerHTML = viewboxY.toFixed(5); }

        if (!zoomState.mouseIsDown) { return; }

        if (zoomState.zoomRect) { zoomState.zoomRect.remove(); }
        let prevViewboxXY = zoomState.prevViewboxXY;

        let newZoomRect = [
            prevViewboxXY, 
            [viewboxX, viewboxY]
        ];

        let g$ = svg$.getElementsByTagName('g')[0];
        zoomState.zoomRect = drawRect(g$, newZoomRect);

        //setXY({x,y});
    }
}


function drawRect(g: SVGGElement, rect: number[][]) {
    const XMLNS = 'http://www.w3.org/2000/svg';

    let [[x0,y0],[x1,y1]] = rect;
    let x = x0 < x1 ? x0 : x1;
    let y = y0 < y1 ? y0 : y1;
    let width = Math.abs(x0-x1);
    let height = Math.abs(y0-y1);

    let $rect = document.createElementNS(XMLNS, 'rect');
    $rect.setAttributeNS(null, "x", x.toString());
    $rect.setAttributeNS(null, "y", y.toString());
    $rect.setAttributeNS(null, "width",  width.toString());
    $rect.setAttributeNS(null, "height", height.toString());
    $rect.setAttributeNS(null, "class", 'zoomrect');

    g.appendChild($rect);

    return $rect;
}


export { mouseMove }
