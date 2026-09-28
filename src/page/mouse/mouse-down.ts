import { StateControl } from "../../state-control/state-control.js";
import { getViewboxXY } from "../fs-consts-types/get-viewbox-xy.js";
import { flipViewboxXY } from "../fs-consts-types/viewbox.js";


function mouseDown(
        stateControl: StateControl,
        svgRef: React.RefObject<SVGSVGElement | null>,
        viewbox: number[][]) {

    return (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        if (event.shiftKey || event.ctrlKey || event.altKey) { return; }
        
        let svg$ = svgRef.current;
        if (!svg$) { return; }
        
        // model coords: the display flip mirrors content about the
        // viewbox y-center
        let viewboxXY = flipViewboxXY(viewbox,
            getViewboxXY(svg$, event.clientX, event.clientY));
        
        clickedForNewViewboxFirst(stateControl, viewboxXY);
    }
}


function clickedForNewViewboxFirst(
        stateControl: StateControl, 
        viewboxXY: number[]) {

    let { transientState } = stateControl;
    let { zoomState } = transientState;

    // Just make sure previous rect is removed
    if (zoomState.zoomRect) { zoomState.zoomRect.remove(); }

    transientState.zoomState = { 
        mouseIsDown: true,
        prevViewboxXY: viewboxXY,
        zoomRect: undefined!
    };
}


export { mouseDown }
