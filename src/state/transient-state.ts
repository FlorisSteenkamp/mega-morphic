import { CpNode, Mat } from "flo-mat";
import { DebugElems } from "../debug/debug.js";
import { ToDraw } from "./to-draw.js";


interface TransientState {
    current: {
        cpNode: CpNode,
        nextElseAround: boolean,
        g: SVGGElement,
    }
    viewboxStack1: number[][][],
    viewboxStack2: number[][][],
    viewboxStack3: number[][][],
    zoomState: {
            mouseIsDown: boolean;
            prevViewboxXY: number[];
            zoomRect: SVGRectElement;
    },
    $svgs: { [T in keyof ToDraw]: SVGElement[][] };
    $svgs2: { [T in keyof ToDraw]: SVGElement[][] };
    // mats: Mat[];
}


export { TransientState }
