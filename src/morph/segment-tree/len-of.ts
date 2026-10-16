import type { Segment, RouteStep } from './segment.js';
import { memoize } from 'flo-memoize';
import { sum } from '../../utils/sum.js';
import { fastPluck, type HasPath } from '../../utils/fast-pluck.js';
import { length$ } from '../fs/length.js';
import { geomOf$ } from './geom-of.js';


function _lenOfs(): (vs: readonly number[][][][]) => number;
function _lenOfs<K extends string>(key: K): (vs: readonly HasPath<K, number[][][]>[]) => number;
function _lenOfs(key?: string) {
    const pluck = key
        ? fastPluck(key) as unknown as (v: unknown) => number[][][]
        : (v: unknown) => v as number[][][];

    return memoize(function(vs: readonly unknown[]) {
        return sum(vs.map(pluck).map(lenOf$));
    });
}

const lenOf$ = memoize(function(pss: number[][][]) {
    return sum(pss.map(length$));
});

const _lenOfs$ = memoize(_lenOfs);

const lenOfs$ = _lenOfs$();

/** total skeleton length of the segments */
const lenOfSegs$ = memoize(function(segs: readonly Segment[]) {
    return sum(segs.map(s => lenOf$(geomOf$(s).skelPss)));
});

/** total skeleton length of the route */
const lenOfRoute$ = memoize(function(route: readonly RouteStep[]) {
    return sum(route.map(st => lenOf$(geomOf$(st.seg).skelPss)));
});


export { lenOf$, lenOfs$, lenOfSegs$, lenOfRoute$, _lenOfs$ }


// Quokka tests
// const a = [
//     { a: { b: [[[1,1], [3,7]]] } },
//     { a: { b: [[[3,3], [3,6]]] } },
//     { a: { b: [[[10,10], [3,6]]] } }
// ];
// _lenOfs$('a.b')(a);//?


// const b = [
//     [[[1,1], [3,7]]],
//     [[[3,3], [3,6]]],
//     [[[10,10], [3,6]]]
// ];
// _lenOfs$()(b);//?