import type { CurvePiece, CpNode } from 'flo-mat';
import { drawFs } from 'flo-draw';
import { getBoundaryPieceBeziers, CpNodeFs } from 'flo-mat';
import { showAndLogCp } from '../log/show-and-log-cp';
import { StateControl } from '../../state-control/state-control';


function createMoreFunctions(stateControl: StateControl) {
    return {
        cp: {
            next: step(stateControl, 'next'),
            prev: step(stateControl, 'prev'),
            nextAndAround: createNextAndAround(stateControl),
            nextOnCircle: step(stateControl, 'nextOnCircle'),
            prevOnCircle: step(stateControl, 'prevOnCircle'),
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


/** the `CpNode` links the console helpers can step along */
type CpLink = 'next' | 'prev' | 'nextOnCircle' | 'prevOnCircle';


/**
 * Returns a function that moves the current `CpNode` along `link`, shows
 * and logs it, and returns it (`undefined` if there is no current node).
 */
function step(stateControl: StateControl, link: CpLink) {
    const use_ = use(stateControl);

    return function() {
        const { current } = stateControl.transientState;

        if (current.cpNode === undefined) { return; }

        return use_(current.cpNode[link]);
    }
}


/** Like `step`, but alternating between `next` and `nextOnCircle`. */
function createNextAndAround(stateControl: StateControl) {
    const toNext = step(stateControl, 'next');
    const toAround = step(stateControl, 'nextOnCircle');

    return function() {
        const { current } = stateControl.transientState;

        if (current.cpNode === undefined) { return; }

        current.nextElseAround = !current.nextElseAround;  // toggle

        return current.nextElseAround ? toNext() : toAround();
    }
}


function createLoop(stateControl: StateControl) {
    return function() {
        let { transientState } = stateControl;
        let { current } = transientState;

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


export { createMoreFunctions }
