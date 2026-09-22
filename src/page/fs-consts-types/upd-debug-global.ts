declare var _debug_: Debug; 
import type { Debug } from 'flo-mat';
import type { StateControl } from '../../state-control/state-control';
import { enableDebugDrawFs } from 'flo-draw';
import { enableDebugForMat } from "flo-mat";
import { enableDebugForBooleanOp } from 'flo-boolean';
import { createMoreFunctions } from './create-more-functions.js';
import { enableDebugForMorph } from '../../debug/enable-debug-for-morph.js';


/** 
 * Set global debug variable.
 */
function updDebugGlobal(
        stateControl: StateControl,
        debugOn: boolean) {

    (window as any)._debug_ = {};
    enableDebugDrawFs(debugOn);
    enableDebugForMat(debugOn);
    enableDebugForMorph(debugOn);
    enableDebugForBooleanOp(debugOn);

    let d = (window as any).d = (window as any)._debug_ as Debug;

    //console.log(d)
    // d.directives.stopAfterHoleClosersNum = 0;
    // d.directives.stopAfterHoleClosers = true;
    //d.directives.stopAfterTwoProngsNum = 1;
    d.directives.stopAfterTwoProngs = false;
    // d.directives.stopAfterThreeProngs = true;
    // d.directives.stopAfterThreeProngsNum = 1;  // not implemented

    if (debugOn) { (window as any).d.m = createMoreFunctions(stateControl); }
}


export { updDebugGlobal }
