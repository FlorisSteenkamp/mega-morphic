import type { CurvePiece, CpNode } from 'flo-mat';
import { drawFs } from 'flo-draw';
import { getBoundaryPieceBeziers, CpNodeFs } from 'flo-mat';
import { showAndLogCp } from '../log/show-and-log-cp';
import { StateControl } from '../../state-control/state-control';


function createMoreFunctions(stateControl: StateControl) {
    return {
        cp: {
            next: createCpNext(stateControl),
            prev: createCpPrev(stateControl),
            nextAndAround: createNextAndAround(stateControl),
            nextOnCircle: createCpNextOnCircle(stateControl),
            prevOnCircle: createCpPrevOnCircle(stateControl),
            loop: createLoop(stateControl),
            use: use(stateControl),
            cur: cur(stateControl),
            ...CpNodeFs
        }
    }
}


function cur(stateControl: StateControl) {
    return function() {
        const { transientState } = stateControl;
        const { current } = transientState;

        return current.cpNode;
    }
}


function use(stateControl: StateControl) {
    return function(cpNode: CpNode) {
        const { transientState } = stateControl;
        const { current } = transientState;
        const pageState = stateControl.state.appState.pageState;

        current.cpNode = cpNode;
        showAndLogCp(current.g, cpNode, pageState.showDelay);

        return cpNode;
    }
}


function createNextAndAround(stateControl: StateControl) {
    return function() {
        let { transientState } = stateControl;
        let { current } = transientState;
        let pageState = stateControl.state.appState.pageState;

        if (current.cpNode === undefined) { return; }

        let nextElseAround = !current.nextElseAround;
        current.nextElseAround = nextElseAround; // Toggle

        if (nextElseAround) {
            let cpNode = current.cpNode.next;
            current.cpNode = cpNode;
            showAndLogCp(current.g, cpNode, pageState.showDelay);
        } else {
            let cpNode = current.cpNode.nextOnCircle;
            current.cpNode = cpNode;
            showAndLogCp(current.g, cpNode, pageState.showDelay);
        }
    }
}


function createLoop(stateControl: StateControl) {
    return function() {
        let { transientState } = stateControl;
        let { current } = transientState;
        let pageState = stateControl.state.appState.pageState;

        if (current.cpNode === undefined) { return; }

        let cpNode = current.cpNode;
        let bps = getBoundaryPieceBeziers([cpNode, cpNode]).filter(v => v !== undefined);

        showLoop(current.g, bps);
    }
}


function showLoop(g: SVGGElement, cps: CurvePiece[], showDelay = 5000) {
    for (let i=0; i<cps.length; i++) {
        let cp = cps[i];
        drawFs.bezierPiece(
            g, cp.curve.ps, cp.ts, 'blue thin20 nofill', showDelay
        );
    }
}


function createCpNextOnCircle(stateControl: StateControl) {
    return function() {
        let { transientState } = stateControl;
        let { current } = transientState;
        let pageState = stateControl.state.appState.pageState;

        if (current.cpNode === undefined) { return; }

        let cpNode = current.cpNode.nextOnCircle;

        current.cpNode = cpNode;
        showAndLogCp(current.g, cpNode, pageState.showDelay);
    }
}


function createCpPrevOnCircle(stateControl: StateControl) {
    return function() {
        let { transientState } = stateControl;
        let { current } = transientState;
        let pageState = stateControl.state.appState.pageState;

        if (current.cpNode === undefined) { return; }

        let cpNode = current.cpNode.prevOnCircle;

        current.cpNode = cpNode;
        showAndLogCp(current.g, cpNode, pageState.showDelay);
    }
}


function createCpNext(stateControl: StateControl) {
    return function() {
        let { transientState } = stateControl;
        let { current } = transientState;
        let pageState = stateControl.state.appState.pageState;

        if (current.cpNode === undefined) { return; }

        let cpNode = current.cpNode.next;

        current.cpNode = cpNode;
        showAndLogCp(current.g, cpNode, pageState.showDelay);

        return cpNode;
    }
}


function createCpPrev(stateControl: StateControl) {
    return function() {
        let { transientState } = stateControl;
        let { current } = transientState;
        let pageState = stateControl.state.appState.pageState;

        if (current.cpNode === undefined) { return; }

        let cpNode = current.cpNode.prev;
        
        current.cpNode = cpNode;
        showAndLogCp(current.g, cpNode, pageState.showDelay);

        return cpNode;
    }
}


export { createMoreFunctions }
