import { CpNode, Mat } from "flo-mat";
import { DebugElems } from "../debug/debug.js";
import type { GeneratedSvgs } from "../page/fs-consts-types/create-empty-generated-svgs.js";


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
    $svgs: GeneratedSvgs;
    $svgs2: GeneratedSvgs;
    // mats: Mat[];
}


export { TransientState }
