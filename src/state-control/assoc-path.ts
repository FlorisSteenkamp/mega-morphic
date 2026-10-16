// Copied (and modified a bit) from Ramda.js (https://ramdajs.com/)
import { assoc } from './assoc.js';


function _prop(
        p: any,
        obj: any) {

    if (obj == null) { return; }

    return obj[p];
}


function assocPath(
        path: (string | number)[],
        val: any,
        obj: { [index: string | number]: any }) {

    if (path.length === 0) { return val; }
    if (path.length === 1) { return assoc(path[0], val, obj); }

    const idx = path[0];

    let nextObj = _prop(idx, obj);
    if (nextObj == null || typeof nextObj !== 'object') {
        nextObj = Number.isInteger(path[1]) ? [] : {};
    }
    val = assocPath(path.slice(1), val, nextObj);

    return assoc(idx, val, obj);
}


export { assocPath }


// Quokka tests
// assocPath(['c','d'], 5, { a: 1, b: 2, c: { d: 2 } });
// assocPath(['c',0], 5, { a: 1, b: 2, c: [1,2,3,4] });