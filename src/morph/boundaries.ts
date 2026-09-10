import { getLastP } from "./get-last-p.js";


/** All resampled segment boundary points of a skeleton path. */
function boundaries(g: number[][][]) {
    return [...g.map(seg => seg[0]), getLastP(g)];
}


export { boundaries }
