import { memoize } from "flo-memoize";
import { getShapeArea } from "flo-boolean";

const { sqrt, abs } = Math;


/**
 * Returns the intrinsic length scale √|loop area| (unit² = the area normalizer)
 */
const getUnit$ = memoize(function(
        loop: (number[][])[]) {

    return sqrt(abs(getShapeArea(loop)))
});


export { getUnit$ }
