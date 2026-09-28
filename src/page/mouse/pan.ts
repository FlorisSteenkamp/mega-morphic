import type { StateControl } from '../../state-control/state-control.js';
import { getViewboxXY } from '../fs-consts-types/get-viewbox-xy.js';
import { toViewBoxStr, getFlipTransform, flipViewboxXY } from '../fs-consts-types/viewbox.js';


/**
 * Ctrl+drag panning of the morph svg: the viewBox attribute is shifted live
 * while dragging (window-level listeners, so releasing outside the svg still
 * ends the pan) and the final viewbox committed to state on release.
 */
function panMouseDown(
        stateControl: StateControl,
        svgRef: React.RefObject<SVGSVGElement | null>) {

    return (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        if (!event.ctrlKey || event.shiftKey || event.altKey) { return; }

        const svg$ = svgRef.current;
        if (svg$ === null) { return; }

        event.preventDefault();

        const { state, upd } = stateControl;

        // The world point grabbed - kept under the cursor while panning.
        // Model coords (display-flip aware): raw y deltas would pan the
        // flipped content the wrong way.
        let vb = state.appState.pageState.viewbox3.map(p => [...p]);
        const grab = flipViewboxXY(vb,
            getViewboxXY(svg$, event.clientX, event.clientY));

        const onMove = (e: MouseEvent) => {
            // flip with the vb in effect for THIS event's CTM
            const cur = flipViewboxXY(vb,
                getViewboxXY(svg$, e.clientX, e.clientY));
            const dx = grab[0] - cur[0];
            const dy = grab[1] - cur[1];
            vb = vb.map(p => [p[0] + dx, p[1] + dy]);
            svg$.setAttribute('viewBox', toViewBoxStr(vb));
            const g$ = svg$.getElementsByTagName('g')[0];
            if (g$) { g$.setAttribute('transform', getFlipTransform(vb)); }
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            upd(state.appState.pageState, { viewbox3: vb });
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };
}


export { panMouseDown }
