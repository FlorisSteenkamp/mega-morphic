import { totalLength } from 'flo-bezier3';
import { memoize } from 'flo-memoize';


const totalLength$ = memoize(
    (ps: number[][]) => totalLength(ps)
);


export { totalLength$ }
