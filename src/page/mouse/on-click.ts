declare var _debug_: Debug;
import { Debug } from '../../debug.js';
import { logNearestBezier } from '../log/log-nearest-bezier.js';
import { getViewBoxForShape } from '../fs-consts-types/viewbox.js';
import { logCpNode } from '../log/log-cp-node.js';
import { logNearestLoopSet } from '../log/log-nearest-loop-set.js';
import { logNearestLoopSimplified } from '../log/log-nearest-loop-simplified.js';
import { logBranch } from '../log/log-branch.js';
import { getViewboxXY } from '../fs-consts-types/get-viewbox-xy.js';
import { StateControl } from '../../state-control/state-control.js';
import { logK } from '../log/log-k.js';
import { logCurve } from '../log/log-curve.js';
import { logThreeProng } from '../log/log-three-prong.js';
import { logTwoProng } from '../log/log-two-prong.js';
import { logMatCurve } from '../log/log-mat-curve.js';
import { logSalience } from '../log/log-salience.js';
import { logFatBranch } from '../log/log-fat-branch.js';


function onClick(
        stateControl: StateControl,
        svgRef: React.RefObject<SVGSVGElement | null>,
        shapeIdx: 1|2) {

    return (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        if (event.shiftKey) { 
            gotoPrevViewbox(stateControl, shapeIdx); 
            return;
        }

        const { state } = stateControl;
        const { pageState } = state.appState;
        const { viewbox1, viewbox2, deduced } = pageState;
        const { mats1, mats2 } = deduced;

        const mats = shapeIdx === 1 ? mats1 : mats2;
        const viewbox = shapeIdx === 1 ? viewbox1 : viewbox2;

        const [viewboxX,viewboxY] = 
            getViewboxXY(svgRef.current!, event.clientX, event.clientY);
        
        const svg$ = svgRef.current;
        if (!svg$) { return; }
        const g = svg$.getElementsByTagName('g')[0];

        // getRoundSalience, getCpChain

        const fs: { [key: string]: (g: SVGGElement, p: number[], delay: number) => void } = {
            twoProng          : logTwoProng(mats),
            threeProng        : logThreeProng(mats),
            bezier            : logNearestBezier(mats),
            loopSimplified    : logNearestLoopSimplified(mats),
            loopset           : logNearestLoopSet(mats),
            cp                : logCpNode(mats, stateControl),
            curvature         : logK(mats),
            branch            : logBranch(mats),
            curve             : logCurve(mats),
            matCurve          : logMatCurve(mats),
            salience          : logSalience(mats),
            roundSalience     : logFatBranch(mats)
        }
        
        const { clickFor, showDelay } = pageState;
        fs[clickFor](g, [viewboxX,viewboxY], showDelay);
    }
}


function gotoPrevViewbox(
        stateControl: StateControl,
        shapeIdx: 1|2) {

    const { transientState, state, upd } = stateControl;
    const { pageState } = state.appState;

    const viewboxStack = shapeIdx === 1
        ? transientState.viewboxStack1
        : transientState.viewboxStack2;

    let viewbox = viewboxStack.pop();

    if (!viewbox) {
        const mats = shapeIdx === 1
            ? pageState.deduced.mats1
            : pageState.deduced.mats2;
        const loops = mats.flatMap(mat => mat.meta.loops)
        const bezierLoops = loops.map(loop => loop.beziers);
        viewbox = getViewBoxForShape(bezierLoops);
    }

    if (shapeIdx === 1) {
        upd(pageState, { viewbox1: viewbox });
    } else {
        upd(pageState, { viewbox2: viewbox });
    }
}


export { onClick }
