declare var _debug_: Debug;
import * as React from 'react';
import type { Debug } from '../../debug/debug.js';
import type { PooledDp } from '../../morph/match-paths/matched-path.js';
import type { PooledChild } from '../../morph/match-paths/pooled-child.js';
import type { FatBranch } from '../../morph/fat-branch/fat-branch.js';
import { bfsBranchIndices } from '../events/show-branch-nums.js';


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
 * Overlay window showing the TRUNK pair's pooled-children Needleman-Wunsch
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
                position: 'fixed',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1001,
                padding: '9px 20px',
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: '1',
                color: '#fff',
                backgroundColor: '#1976d2',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
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
    const trees = _debug_.elems.matchTrees.at(-1);
    if (pm?.trunk.pooledDp === undefined || trees === undefined) {
        return <div style={windowStyle}>
            no match data - click morph first (then re-toggle)
        </div>;
    }

    // Same numbering as the "branch #s" overlay.
    const idx1 = bfsBranchIndices(trees.tree1);
    const idx2 = bfsBranchIndices(trees.tree2);

    return <div style={windowStyle}>
        <b>Trunk pooled-children DP</b> (cost {pm.trunk.cost.childCost.toFixed(3)},
        &nbsp;flipped {`${pm.flipped}`}) — traceback:
        <span style={{ background: opColors.match }}> match </span>
        <span style={{ background: opColors.delete }}> delete </span>
        <span style={{ background: opColors.insert }}> insert </span>
        {pm.trunk.pooledDp.map(dp => (
            <DpTable key={dp.side} dp={dp} idx1={idx1} idx2={idx2} />
        ))}
    </div>;
}


function DpTable(props: {
        dp: PooledDp;
        idx1: Map<FatBranch, number>;
        idx2: Map<FatBranch, number> }) {

    const { dp, idx1, idx2 } = props;
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
            side {dp.side > 0 ? '+1 (out)' : '−1 (back)'}
            &nbsp;— A: {as.length}, B: {bs.length} children
        </div>
        <table style={{ borderCollapse: 'collapse', marginTop: '4px' }}>
            <thead>
                <tr>
                    <th style={headStyle}>A \ B</th>
                    <th style={headStyle}>∅</th>
                    {bs.map((b, k) => (
                        <th key={k} style={headStyle}>{childLabel(b, idx2)}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {D.map((row, r) => (
                    <tr key={r}>
                        <th style={headStyle}>
                            {r === 0 ? '∅' : childLabel(as[r - 1], idx1)}
                        </th>
                        {row.map((v, c) => (
                            <td
                                key={c}
                                style={{
                                    ...cellStyle,
                                    background:
                                        opColors[path.get(`${r},${c}`)!]
                                        ?? undefined
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


/** "#<branch-#s overlay index> @<dist along path>" */
function childLabel(c: PooledChild, idx: Map<FatBranch, number>): string {
    const n = idx.get(c.edge.branch);
    return `#${n ?? '?'} @${c.dist.toFixed(0)}`;
}


export { NeedleWindow }
