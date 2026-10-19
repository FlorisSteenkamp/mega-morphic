import type { ToDrawKey } from "../../state/to-draw.js";
import { toDrawKeys } from "../../state/to-draw.js";


/** the drawn svg elements per drawable debug element */
type GeneratedSvgs = Record<ToDrawKey, SVGElement[][]>;


function createEmptyGeneratedSvgs(): GeneratedSvgs {
    return Object.fromEntries(
        toDrawKeys.map(k => [k, [] as SVGElement[][]])
    ) as GeneratedSvgs;
}


export { createEmptyGeneratedSvgs }
export type { GeneratedSvgs }
