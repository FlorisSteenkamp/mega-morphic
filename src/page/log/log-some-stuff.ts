declare var _debug_: Debug;
import { Debug } from '../../debug/debug';
import { CpNodeFs } from 'flo-mat';
import { mapObj } from '../../utils/map-obj';

const { getProngCount } = CpNodeFs;


function logSomeStuff(timingAll: number) {
    // console.log(`All took: ${timingAll.toFixed(0)} milliseconds.`);
    
    function addToVertexCount(
            vertexCount: { [index: number]: number },
            n: number,
            i: number) {

        if (!vertexCount[n]) { vertexCount[n] = 0; } 
        vertexCount[n] += i;
    }

    const { timing } = _debug_;
    const {
        simplifyPaths, normalize,  // flo-boolean
        oneAnd2Prongs, threeProngs, holeClosers, simplifyMat, sats  // flo-boolean
    } = timing;

    // console.log(`All took ${timingAll.toFixed(0)} milliseconds; simplify-paths: ${simplifyPaths.toFixed(0)}; 1&2-prongs: ${oneAnd2Prongs.toFixed(0)}; 3-prongs: ${threeProngs.toFixed(0)}; hole-closers: ${holeClosers.toFixed(0)}; simplify-mats: ${simplifyMat.toFixed(0)}; sats: ${sats.toFixed(0)}; normalize: ${normalize.toFixed(0)}`);
    console.log(`All took ${timingAll.toFixed(0)} milliseconds.`);
    // console.log(mapObj<any>(v => Math.round(v), timing));

    const timingsOther = timingAll - 
        normalize -
        simplifyPaths -
        holeClosers -
        oneAnd2Prongs -
        threeProngs -
        sats -
        simplifyMat

    
    //for (const n in vertexCount) { console.log('# of '+n+'-prongs: ', vertexCount[n]); }
    // console.log(`    normalize paths    ${getTiming(normalize)}`);
    // console.log(`    simplify paths     ${getTiming(simplifyPaths)}`);
    // console.log(`    hole-closers       ${getTiming(holeClosers)}`);
    // console.log(`    1 & 2-prongs       ${getTiming(oneAnd2Prongs)}`);
    // console.log(`    3-prongs           ${getTiming(threeProngs)}`);
    // console.log(`    sats               ${getTiming(sats)}`);
    // console.log(`    simplify mats      ${getTiming(simplifyMat)}`);
    // console.log(`    other              ${getTiming(timingsOther)}`);
}


function getTiming(timing: number) {
    return ' took ' + timing.toFixed(0) + ' milliseconds.';
}


export { logSomeStuff }
