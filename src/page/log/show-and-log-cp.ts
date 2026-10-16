import type { CpNode } from 'flo-mat';
import { getProngCount, getRealProngCount, isSharp, isOneProng } from 'flo-mat';
import { drawFs } from 'flo-draw';


function showAndLogCp(
        g: SVGGElement,
        cp: CpNode,
        showDelay = 2000) {

    const pos = cp.pointOnShape;
    // drawFs.crossHair(g, pos.p, 'nofill thin5 red', scale*0.5, showDelay);
    drawFs.crossHair(g, pos.circle.center, 'nofill thin5 red', 0.5, showDelay);
    drawFs.line(g, [pos.p, pos.circle.center], 'nofill thin20 red', showDelay);
    drawFs.circle(g, pos.circle, 'nofill thin5 blue', showDelay)
    
    // Log
    const prongCount = getProngCount(cp);
    const realProngCount = getRealProngCount(cp);
    console.log(
        prongCount,realProngCount,
        isSharp(cp),
        isOneProng(cp)
    );
    console.log(cp);
}


export { showAndLogCp }

