import type { StateControl } from '../../state-control/state-control.js';
import { getViewboxXY } from '../fs-consts-types/get-viewbox-xy.js';
import { toViewBoxStr } from '../fs-consts-types/viewbox.js';


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
        const grab = getViewboxXY(svg$, event.clientX, event.clientY);
        let vb = state.appState.pageState.viewbox3.map(p => [...p]);

        const onMove = (e: MouseEvent) => {
            const cur = getViewboxXY(svg$, e.clientX, e.clientY);
            const dx = grab[0] - cur[0];
            const dy = grab[1] - cur[1];
            vb = vb.map(p => [p[0] + dx, p[1] + dy]);
            svg$.setAttribute('viewBox', toViewBoxStr(vb));
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
