import { calcProcrustes$ } from '../../procrustes/calc-procrustes.js';


/**
 * Mean shape anisotropy of a glyph pair (|c₂₀|/(Ixx+Iyy) per glyph): scales
 * the sway tie-break of the trunk orientation (0 = pose-blind).
 */
function anisoOf(
        loopA: number[][][],
        loopB: number[][][]): number {

    return (
        calcProcrustes$(loopA).anisotropy +
        calcProcrustes$(loopB).anisotropy
    ) / 2;
}


export { anisoOf }
