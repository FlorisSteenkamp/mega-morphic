import { StateControl } from "../../state-control/state-control.js";
import { getViewboxXY } from "../fs-consts-types/get-viewbox-xy.js";
import { flipViewboxXY } from "../fs-consts-types/viewbox.js";

const { min, max } = Math;


function mouseUp(
        stateControl: StateControl,
        svgRef: React.RefObject<SVGSVGElement | null>,
        shapeIdx: 1|2|3) {

    return (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        if (event.shiftKey || event.ctrlKey || event.altKey) { return; }

        let svg$ = svgRef.current;
        if (!svg$) { return; }

        let viewboxXY = getViewboxXY(svg$, event.clientX, event.clientY);
        
        clickedForNewViewboxSecond(stateControl, viewboxXY, shapeIdx);
    }
}


function clickedForNewViewboxSecond(
        stateControl: StateControl, 
        viewboxXY: number[],
        shapeIdx: 1|2|3) {

    // Get info
    let { state, upd, transientState } = stateControl;
    let { pageState } = state.appState;
    const vbKey = `viewbox${shapeIdx}` as const;
    const viewbox = pageState[vbKey];
    let { zoomState } = transientState;
    let { prevViewboxXY } = zoomState;

    // into model coords (prevViewboxXY was flipped at mouse-down)
    viewboxXY = flipViewboxXY(viewbox, viewboxXY);

    // Update transient info
    zoomState.mouseIsDown = false;
    if (zoomState.zoomRect) { zoomState.zoomRect.remove(); }

    // the dragged rectangle, whichever corner it was dragged from
    const [a0, a1] = prevViewboxXY;
    const [b0, b1] = viewboxXY;
    const newViewbox = [[min(a0, b0), min(a1, b1)], [max(a0, b0), max(a1, b1)]];

    let viewboxW = viewbox[1][0] - viewbox[0][0];
    let viewboxH = viewbox[1][1] - viewbox[0][1];
    let newViewboxW = newViewbox[1][0] - newViewbox[0][0];
    let newViewboxH = newViewbox[1][1] - newViewbox[0][1];

    let relWidth = newViewboxW / viewboxW;
    let relHeight = newViewboxH / viewboxH;

    if (relWidth < 0.01 || relHeight < 0.01) { return; }

    transientState[`viewboxStack${shapeIdx}`].push(viewbox);
    upd(pageState, { [vbKey]: newViewbox });
}


export { mouseUp }
