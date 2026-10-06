import { Mat } from 'flo-mat';
import { getNearestCpNode } from '../get-nearest/get-nearest-cp-node.js';
import { getFatBranchTree } from './fat-branch/get-fat-branch-tree.js';
import { drawFatBranchTree } from './draw-fat-branch.js';


function logFatBranch(
        mats: Mat[],
        fullTree: boolean) {

    return function(g: SVGGElement, p: number[], showDelay?: number) {
        const cpNode = getNearestCpNode(mats, p).t;
        // const cpNode = mats[0].cpNode;

        const fatBranchTree = getFatBranchTree(cpNode);
        if (fatBranchTree === undefined) { return; }

        drawFatBranchTree(g, showDelay, fatBranchTree, fullTree);

        console.log(fatBranchTree);
    }
}


export { logFatBranch }



// Temp for testing
// function getSkeletonLengthDepths(
//         cpChain: CpNode[]): number[] {

//     const depths: number[] = [0];
//     const seen = new Set<string>();
//     let d = 0;

//     let a = 0;
//     for (let i=0; i<cpChain.length - 1; i++) {
//         const cp = cpChain[i];

//         if (cpChain[i+1] === cp.next) {
//             const key = getEdgeKey(cp, cp.next);
//             const len = totalLength$(getMatCurveToNext(cp));
//             // if (len === 0 && getRealProngCount(cp) > 1) { console.log(getRealProngCount(cp))}
//             if (getRealProngCount(cp) === 1 && getRealProngCount(cp.next) === 1) {
//                 console.log(len);
//                 console.log({
//                     i,
//                     id: cp.id,
//                     cp: cp,
//                     circleId: getCircleId(cp)
//                 });
//                 a++;
//             }
//             if (seen.has(key)) {
//                 d -= len;
//             } else {
//                 seen.add(key);
//                 d += len;
//             }
//         }

//         depths.push(d);
//     }
//     console.log(a);

//     return depths;
// }