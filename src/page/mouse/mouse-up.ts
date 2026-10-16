import { StateControl } from "../../state-control/state-control.js";
import { getViewboxXY } from "../fs-consts-types/get-viewbox-xy.js";
import { flipViewboxXY } from "../fs-consts-types/viewbox.js";


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
    const viewbox = shapeIdx === 1 ? pageState.viewbox1
        : shapeIdx === 2 ? pageState.viewbox2
        : pageState.viewbox3;
    let { zoomState } = transientState;
    let { prevViewboxXY } = zoomState;

    // into model coords (prevViewboxXY was flipped at mouse-down)
    viewboxXY = flipViewboxXY(viewbox, viewboxXY);

    // Update transient info
    zoomState.mouseIsDown = false;
    if (zoomState.zoomRect) { zoomState.zoomRect.remove(); }

    // Swap if necessary
    if (viewboxXY[0] < prevViewboxXY[0]) {
        [viewboxXY[0], prevViewboxXY[0]] = [prevViewboxXY[0], viewboxXY[0]];
    }
    if (viewboxXY[1] < prevViewboxXY[1]) {
        [viewboxXY[1], prevViewboxXY[1]] = [prevViewboxXY[1], viewboxXY[1]];
    }

    let newViewbox = [prevViewboxXY, viewboxXY];

    let viewboxW = viewbox[1][0] - viewbox[0][0];
    let viewboxH = viewbox[1][1] - viewbox[0][1];
    let newViewboxW = viewboxXY[0] - prevViewboxXY[0];
    let newViewboxH = viewboxXY[1] - prevViewboxXY[1];

    let relWidth = newViewboxW / viewboxW;
    let relHeight = newViewboxH / viewboxH;

    if (relWidth < 0.01 || relHeight < 0.01) { return; }

    if (shapeIdx === 1) {
        transientState.viewboxStack1.push(viewbox);
        upd(pageState, { viewbox1: newViewbox });
    } else if (shapeIdx === 2) {
        transientState.viewboxStack2.push(viewbox);
        upd(pageState, { viewbox2: newViewbox });
    } else {
        transientState.viewboxStack3.push(viewbox);
        upd(pageState, { viewbox3: newViewbox });
    }
}


export { mouseUp }
