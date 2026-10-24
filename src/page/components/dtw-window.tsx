declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { DtwTable } from '../../morph/match-paths/path-align-debug.js';
import { vertexIds$ } from '../../debug/segment-tree/vertex-ids.js';
import { btnStyleBlue } from '../btn-styles.js';
import {
    useChildDtwPairRefresh, routeLabel, windowStyle, cellStyle, headStyle
} from './needle-window.js';


/** Path-cell tint per DP state (as the needle window's ops). */
const stateColors = [
    '#c8e6c9',   // diagonal (green)
    '#ffcdd2',   // A advances alone - a gap in B (red)
    '#bbdefb'    // B advances alone - a gap in A (blue)
] as const;


/**
 * Overlay window showing a pair's DTW table: the matcher's DP over the two
 * routes' samples (`DtwTable`), its chosen path tinted by state - for the
 * child pair last evaluated by the child-DTW tool (`childDtwPair`), else the
 * trunk pair (as the needle window).
 *
 * * data from the last morph's `pathMatchResult` and the child-DTW tool
 *   (debug-only)
 */
function DtwWindow(props: { onClose: () => void }) {
    useChildDtwPairRefresh();

    return <>
        {dtwContent()}
        <button
            onClick={props.onClose}
            style={{
                ...btnStyleBlue,
                position: 'fixed',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1001,
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            }}
        >
            close DTW
        </button>
    </>;
}


function dtwContent() {
    if (typeof _debug_ === 'undefined') {
        return <div style={windowStyle}>debug mode is off</div>;
    }
    const pm = _debug_.elems.pathMatchResult.at(-1);
    if (pm === undefined) {
        return <div style={windowStyle}>no match data - click morph first</div>;
    }

    const picked = _debug_.elems.childDtwPair?.[0];
    const pair = picked?.sub ?? pm.trunk;
    const align = picked !== undefined ? picked.align : pm.trunk.align;

    const routes = <>
        A {routeLabel(pair.routeA, vertexIds$(pm.gA))},
        B {routeLabel(pair.routeB, vertexIds$(pm.gB))}
    </>;
    const title = picked === undefined
        ? <><b>Trunk DTW</b> ({routes})</>
        : <><b>Clicked pair's DTW</b> ({routes})</>;

    if (align === undefined) {
        return <div style={windowStyle}>
            {title} — no table: its routes have no length or couldn't be
            traced
        </div>;
    }

    const { dp } = align;

    return <div style={windowStyle}>
        {title} — value = shape − del × covered (what the DP minimizes),
        path:
        <span style={{ background: stateColors[0] }}> diagonal </span>
        <span style={{ background: stateColors[1] }}> A alone </span>
        <span style={{ background: stateColors[2] }}> B alone </span>
        <div style={{ marginTop: '4px' }}>
            {dp.fromEnds
                ? 'run from the routes\' ends (a child pair: from its ' +
                    'junctions) - row/column 0 is the junction'
                : 'run from the routes\' starts'}
            &nbsp;— A: {dp.values.length}, B: {dp.values[0]?.length ?? 0} samples
        </div>
        <DtwTableView dp={dp} />
    </div>;
}


function DtwTableView(props: { dp: DtwTable }) {
    const { values, path } = props.dp;

    const onPath = new Map(path.map(({ i, j, state }) => [`${i},${j}`, state]));

    return <table style={{ borderCollapse: 'collapse', marginTop: '6px' }}>
        <thead>
            <tr>
                <th style={headStyle}>A \ B</th>
                {(values[0] ?? []).map((_, j) => (
                    <th key={j} style={headStyle}>{j}</th>
                ))}
            </tr>
        </thead>
        <tbody>
            {values.map((row, i) => (
                <tr key={i}>
                    <th style={headStyle}>{i}</th>
                    {row.map((v, j) => {
                        const state = onPath.get(`${i},${j}`);
                        return <td
                            key={j}
                            style={{
                                ...cellStyle,
                                ...(state !== undefined
                                    ? { background: stateColors[state] }
                                    : {})
                            }}
                        >
                            {v === Infinity ? '∞' : v.toFixed(3)}
                        </td>;
                    })}
                </tr>
            ))}
        </tbody>
    </table>;
}


export { DtwWindow }
