import type { CpNode } from "flo-mat";
import { getAllOnCircle } from "flo-mat";

const { min } = Math;


function getCircleId(cp: CpNode): number {
    return min(...getAllOnCircle(cp).map(c => c.id));
}


export { getCircleId }
