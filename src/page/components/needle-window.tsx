declare var _debug_: Debug;
import type { Debug } from '../../debug/debug.js';
import type { Circle } from 'flo-mat';
import type { SegDp } from '../../morph/segment-tree/match-seg-trees/seg-dp.js';
import type { SegChild } from '../../morph/segment-tree/match-seg-trees/seg-child.js';
import { vertexIds$ } from '../../debug/segment-tree/vertex-ids.js';
import { geomOf$ } from '../../morph/segment-tree/geom-of.js';
import { btnStyleBlue } from '../btn-styles.js';


const windowStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: '50vh',
    overflow: 'auto',
    background: '#fff',
    borderBottom: '2px solid #1976d2',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    zIndex: 1000,
    padding: '10px 14px',
    fontSize: '12px',
    fontFamily: 'monospace'
};

const cellStyle: React.CSSProperties = {
    border: '1px solid #ccc',
    padding: '2px 6px',
    textAlign: 'right',
    whiteSpace: 'nowrap'
};

const headStyle: React.CSSProperties = {
    ...cellStyle,
    background: '#f0f0f0',
    fontWeight: 700,
    textAlign: 'center'
};

/** Traceback-cell tint per op type. */
const opColors = {
    match: '#c8e6c9',   // green
    delete: '#ffcdd2',  // red (A consumed)
    insert: '#bbdefb'   // blue (B consumed)
} as const;


/**
 * Overlay window showing the TRUNK pair's children Needleman-Wunsch
 * scoring matrices (one per side), traceback cells tinted by op type.
 * Data comes from the last morph's `pathMatchResult` (debug-only).
 */
function NeedleWindow(props: { onClose: () => void }) {
    const content = needleContent();

    return <>
        {content}
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
            close needle
        </button>
    </>;
}


function needleContent() {
    if (typeof _debug_ === 'undefined') {
        return <div style={windowStyle}>debug mode is off</div>;
    }
    const pm = _debug_.elems.pathMatchResult.at(-1);
    if (pm?.trunk.dp === undefined) {
        return <div style={windowStyle}>
            no match data - click morph first (then re-toggle)
        </div>;
    }

    const { cost, shapeCost, dp } = pm.trunk;
    const childCost = cost - shapeCost;
    const idsA = vertexIds$(pm.gA);
    const idsB = vertexIds$(pm.gB);

    return <div style={windowStyle}>
        <b>Trunk children DP</b> (cost {childCost.toFixed(3)}) — traceback:
        <span style={{ background: opColors.match }}> match </span>
        <span style={{ background: opColors.delete }}> delete </span>
        <span style={{ background: opColors.insert }}> insert </span>
        <DpTable dp={dp} idsA={idsA} idsB={idsB} />
    </div>;
}


function DpTable(props: {
        dp: SegDp;
        idsA: Map<Circle, number>;
        idsB: Map<Circle, number> }) {

    const { dp, idsA, idsB } = props;
    const { D, as, bs, ops } = dp;

    // Traceback cells: walk ops from (0,0), tint the ARRIVED-AT cell.
    const path = new Map<string, keyof typeof opColors>();
    let i = 0;
    let j = 0;
    path.set('0,0', 'match');
    for (const op of ops) {
        if (op.type === 'match') { i++; j++; }
        else if (op.type === 'delete') { i++; }
        else { j++; }
        path.set(`${i},${j}`, op.type);
    }

    return <div style={{ marginTop: '10px' }}>
        <div style={{ fontWeight: 700 }}>
            around the outline (cyclic: A shown from its best cut)
            &nbsp;— A: {as.length}, B: {bs.length} children
        </div>
        <table style={{ borderCollapse: 'collapse', marginTop: '4px' }}>
            <thead>
                <tr>
                    <th style={headStyle}>A \ B</th>
                    <th style={headStyle}>∅</th>
                    {bs.map((b, k) => (
                        <th key={k} style={headStyle}>{childLabel(b, idsB)}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {D.map((row, r) => (
                    <tr key={r}>
                        <th style={headStyle}>
                            {r === 0 ? '∅' : childLabel(as[r - 1], idsA)}
                        </th>
                        {row.map((v, c) => (
                            <td
                                key={c}
                                style={{
                                    ...cellStyle,
                                    background:
                                        opColors[path.get(`${r},${c}`)!]
                                }}
                            >
                                {v.toFixed(3)}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>;
}


/** "v<entry-segment vertex ids> @<dist along route>" (ids as `showVertexNums`) */
function childLabel(c: SegChild, ids: Map<Circle, number>): string {
    const { vertS, vertE } = geomOf$(c.entry);
    return `v${ids.get(vertS)}·${ids.get(vertE)} @${c.dist.toFixed(0)}`;
}


export { NeedleWindow }
