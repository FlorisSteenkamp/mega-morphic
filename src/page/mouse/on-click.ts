declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { ClickFor } from '../../state/click-for.js';
import type { StateControl } from '../../state-control/state-control.js';
import { logNearestBezier } from '../log/log-nearest-bezier.js';
import { getViewBoxForShape } from '../fs-consts-types/viewbox.js';
import { logCpNode } from '../log/log-cp-node.js';
import { logNearestLoopSet } from '../log/log-nearest-loop-set.js';
import { logNearestLoopSimplified } from '../log/log-nearest-loop-simplified.js';
import { getViewboxXY } from '../fs-consts-types/get-viewbox-xy.js';
import { flipViewboxXY } from '../fs-consts-types/viewbox.js';
import { logK } from '../log/log-k.js';
import { logCurve } from '../log/log-curve.js';
import { logThreeProng } from '../log/log-three-prong.js';
import { logTwoProng } from '../log/log-two-prong.js';
import { logMatCurve } from '../log/log-mat-curve.js';
import { logSalience } from '../log/log-salience.js';
import { logOwnMaterial } from '../log/log-own-material.js';
import { logPathMatchResult } from '../log/log-path-match-result.js';
import { logProfileAlignment } from '../log/log-profile-alignment.js';
import { logChildDtw } from '../log/log-child-dtw.js';
import { logMorphBezier } from '../log/log-morph-bezier.js';
import type { PageData } from '../page-data.js';
import { getG } from '../../draw/get-g.js';


function onClick(
        stateControl: StateControl,
        svgRef: React.RefObject<SVGSVGElement | null>,
        shapeIdx: 1|2|3,
        refPageData?: React.RefObject<PageData | null>) {

    return (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        if (event.shiftKey) { 
            gotoPrevViewbox(stateControl, shapeIdx); 
            return;
        }

        // The morph svg supports only the m-bezier inspector.
        if (shapeIdx === 3) {
            const { pageState } = stateControl.state.appState;
            const svg3$ = svgRef.current;
            if (pageState.clickFor !== 'mBezier' ||
                refPageData === undefined || !svg3$) { return; }
            const g3 = getG(svg3$);
            const p = flipViewboxXY(pageState.viewbox3,
                getViewboxXY(svg3$, event.clientX, event.clientY));
            logMorphBezier(refPageData)(g3, p, pageState.showDelay);
            return;
        }

        const { state } = stateControl;
        const { pageState } = state.appState;
        const { viewbox1, viewbox2, deduced } = pageState;
        const { mats1, mats2 } = deduced;

        const mats = shapeIdx === 1 ? mats1 : mats2;
        const viewbox = shapeIdx === 1 ? viewbox1 : viewbox2;

        const svg$ = svgRef.current;
        if (!svg$) { return; }
        const g = getG(svg$);

        const [viewboxX,viewboxY] = flipViewboxXY(viewbox,
            getViewboxXY(svg$, event.clientX, event.clientY));

        const fs: Record<ClickFor,
                (g: SVGGElement, p: number[], delay: number) => void> = {
            twoProng          : logTwoProng(mats),
            threeProng        : logThreeProng(mats),
            bezier            : logNearestBezier(mats),
            loopSimplified    : logNearestLoopSimplified(mats),
            loopset           : logNearestLoopSet(mats),
            cp                : logCpNode(mats, stateControl),
            curvature         : logK(mats),
            curve             : logCurve(mats),
            matCurve          : logMatCurve(mats),
            salience          : logSalience(mats),
            fatBranch         : logOwnMaterial(shapeIdx, false),
            fatTree           : logOwnMaterial(shapeIdx, true),
            pathMatchResult   : logPathMatchResult,
            profileAlign      : logProfileAlignment,
            childDtw          : logChildDtw(shapeIdx, pageState.pathWeights),
            mBezier           : () =>
                console.log('m-bezier inspects the MORPH svg - click there')
        }
        
        const { clickFor, showDelay } = pageState;
        if (clickFor === undefined) { return; }
        fs[clickFor](g, [viewboxX,viewboxY], showDelay);
    }
}


function gotoPrevViewbox(
        stateControl: StateControl,
        shapeIdx: 1|2|3) {

    const { transientState, state, upd } = stateControl;
    const { pageState } = state.appState;

    let viewbox = transientState[`viewboxStack${shapeIdx}`].pop();

    if (!viewbox) {
        const { mats1, mats2 } = pageState.deduced;
        // The morph shows both glyphs - fit their combined extent.
        const mats = shapeIdx === 1 ? mats1
            : shapeIdx === 2 ? mats2
            : [...mats1, ...mats2];
        const loops = mats.flatMap(mat => mat.meta.loops)
        const bezierLoops = loops.map(loop => loop.beziers);
        viewbox = getViewBoxForShape(bezierLoops);
    }

    upd(pageState, { [`viewbox${shapeIdx}`]: viewbox });
}


export { onClick }
