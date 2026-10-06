import { memoize } from 'flo-memoize';
import { sum } from '../../utils/sum.js';
import { fastPluck, type HasPath } from '../../utils/fast-pluck.js';
import { length$ } from '../fs/length.js';


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
const lenOfRoute$ = _lenOfs$('seg.skelPss');
const lenOfSegs$ = _lenOfs$('skelPss');


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