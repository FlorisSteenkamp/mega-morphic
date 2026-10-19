import type { CpNode, Mat } from "flo-mat";
import { CpNodeFs } from "flo-mat";
import { distanceBetween } from "flo-vector2d";
import { getNearest } from '../../utils/get-nearest.js';


/**
 * The MAT vertex (passing `pred`) whose maximal disk center is nearest to
 * `p`.
 *
 * @param mats
 * @param p
 * @param pred which vertices to consider, e.g. 2-prongs
 */
function getNearestVertex(
        mats: Mat[],
        p: number[],
        pred: (cpNode: CpNode) => boolean) {

    const cpNodes = mats.flatMap(mat => {
        const vertices: CpNode[] = [];
        CpNodeFs.traverseVertices(mat.cpNode, cpNode => {
            if (pred(cpNode)) { vertices.push(cpNode); }
        });

        return vertices;
    });

    return getNearest(
        (p, t) => distanceBetween(p, t.pointOnShape.circle.center),
        cpNodes,
        p
    );
}


export { getNearestVertex }
