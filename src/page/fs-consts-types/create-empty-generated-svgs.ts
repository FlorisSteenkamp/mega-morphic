import type { DebugElemsMat } from "../../debug.js";
import type { ToDraw } from "../../state/to-draw.js";


type GeneratedSvgs = { [T in keyof ToDraw]: SVGElement[][] };
type MutableGeneratedSvgs = { -readonly [T in keyof ToDraw]: SVGElement[][] };


const emptyDebugElems: DebugElemsMat = {
    oneProng: [],
    twoProng: [],
    threeProng: [],
    looseBoundingBox: [],
    tightBoundingBox: [],
    boundingHull: [],
    vertex: [],
    mat: [],
    maxVertex: [],
    leaves: [],
    cull: [],
    cpNode: [],
    branch: [],
    holeCloser: []
};


function createEmptyGeneratedSvgs():
        GeneratedSvgs {

    // Build via a mutable view, then return as the readonly shape.
    const elems = {} as MutableGeneratedSvgs;
    for (const k in emptyDebugElems) {
        elems[k as keyof ToDraw] = [];
    }

    return elems;
}


export { createEmptyGeneratedSvgs, emptyDebugElems }
