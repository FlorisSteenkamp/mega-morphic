import { CpNode, CpNodeFs, Mat } from "flo-mat";
import { distanceBetween } from "flo-vector2d";
import { getNearest } from '../../utils/get-nearest.js';


function getNearestTwoProng(
        mats: Mat[],
        p: number[]) {

    const cpNodes = mats.flatMap(mat => {
        const threeProngs: CpNode[] = [];
        CpNodeFs.traverseVertices(mat.cpNode, cpNode => {
            if (CpNodeFs.getRealProngCount(cpNode) === 2) {
                threeProngs.push(cpNode);
            }
        });

        return threeProngs;
    })
    
    return getNearest(
        (p, t) => distanceBetween(p, t.pointOnShape.circle.center),
        cpNodes,
        p
    );
}


export { getNearestTwoProng }
