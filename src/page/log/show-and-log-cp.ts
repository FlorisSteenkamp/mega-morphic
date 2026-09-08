import type { CpNode } from 'flo-mat';
import { enhanceCpNode, getProngCount, getRealProngCount, isTerminating, isFullyTerminating } from 'flo-mat';
import { drawFs } from 'flo-draw';
// import { getInitialDegAngleBetweenMatCurves } from '../../../mat/src/cp-node/fs/get-angle-between-mat-curves';
// import { getNonTerminatingOnCircle } from '../../../mat/src/cp-node/fs/get-non-terminating-on-circle';


// const { enhanceCpNode, getRealProngCount, getProngCount, isTerminating } = CpNodeFs;


function showAndLogCp(
        g: SVGGElement,
        cpNode: CpNode,
        showDelay = 2000,
        scale = 1) {

    // let cp = cpNode.cp;
    // let pos = cp.pointOnShape;
    const pos = cpNode.pointOnShape;
    // drawFs.crossHair(g, pos.p, 'nofill thin5 red', scale*0.5, showDelay);
    drawFs.crossHair(g, pos.circle.center, 'nofill thin5 red', scale*0.5, showDelay);
    drawFs.line(g, [pos.p, pos.circle.center], 'nofill thin20 red', showDelay);
    drawFs.circle(g, pos.circle, 'nofill thin5 blue', showDelay)
    
    // Log
    const prongCount = getProngCount(cpNode);
    const realProngCount = getRealProngCount(cpNode);
    // console.log(prongCount,realProngCount)
    // if (getRealProngCount(cpNode) === 2) {
    //     const [cpNode1,cpNode2] = getNonTerminatingOnCircle(cpNode);
    //     const angle = getInitialDegAngleBetweenMatCurves(cpNode1,cpNode2);
    //     console.log(angle);
    // }

    // const enhancedCpNode = enhanceCpNode(cpNode);

    // console.log(enhancedCpNode);
    // console.log(enhancedCpNode.ordering);
    // console.log(
    //     isTerminating(cpNode),
    //     isFullyTerminating(cpNode),
    //     cpNode.next === cpNode.nextOnCircle,
    //     cpNode.cp.pointOnShape.p,
    // );
    // console.log(
    //     isTerminating(cpNode),
    //     isFullyTerminating(cpNode),
    //     cpNode.cp.pointOnShape.p
    // );
    console.log(
        // cpNode.holeCloserTwin,
        // cpNode.isHoleClosing
        pos
    );

    // if (pos.curvePieces) {
    //     const { curvePieces } = pos;
    //     for (let curvePiece of curvePieces) {
    //         const { curve, ts } = curvePiece;
    //         const { ps } = curve;
    //         drawFs.bezierPiece(g, ps, ts, 'nofill thin20 red', 2*showDelay);
    //     }
    // }
    // console.log(traverseCp(cpNode).map(enhanceCpNode));
    // console.log('salience: ' + CpNodeFs.getSalience(cpNode));
    // console.log('p: ' + pos.p);
}


export { showAndLogCp }

