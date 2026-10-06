import { getLastP } from './get-last-p.js';


/** All segment boundary points of a skeleton path (each bezier's start
 *  point plus the path's end point). */
function boundaries(pss: number[][][]): number[][] {
    return [...pss.map(ps => ps[0]), getLastP(pss)];
}


export { boundaries }
