import { Mat } from 'flo-mat';
import { showAndLogCp } from './show-and-log-cp.js';
import { StateControl } from '../../state-control/state-control.js';
import { getNearestCpNode } from '../get-nearest/get-nearest-cp-node.js';


function logCpNode(
        mats: Mat[],
        stateControl: StateControl) {

    return function(
            g: SVGGElement,
            p: number[],
            showDelay = 1000) {

        let { transientState } = stateControl;
        let { current } = transientState;

        const { t: cpNode } = getNearestCpNode(mats, p);

        current.g = g;

        if (cpNode === undefined) { return; }
        
        current.cpNode = cpNode;

        showAndLogCp(g, cpNode, showDelay);
    }
}


export { logCpNode }
