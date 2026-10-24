import type { Mat } from 'flo-mat';
import { useMemo } from 'react';
import { segTreeFromCp } from '../../morph/segment-tree/seg-tree-from-cp.js';
import { lenOfSegs$ } from '../../morph/segment-tree/len-of.js';


/** the page's padding - the panel reaches past it to the window's edges */
const PAGE_PAD = 10;

/**
 * over the header's right end: from the window's top and right edges down
 * to the header's bottom, over the header's controls
 */
const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: -PAGE_PAD,
    right: -PAGE_PAD,
    bottom: 0,
    width: '400px',
    boxSizing: 'border-box',
    overflow: 'auto',
    background: '#fff',
    borderLeft: '1px solid #ccc',
    padding: '8px 10px',
    zIndex: 10,
    fontSize: '12px',
    fontFamily: 'monospace'
};

/** the show/hide button: the panel's top right corner, always there */
const eyeStyle: React.CSSProperties = {
    position: 'absolute',
    top: -PAGE_PAD + 4,
    right: -PAGE_PAD + 4,
    zIndex: 11,
    width: '26px',
    height: '22px',
    padding: 0,
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const cellStyle: React.CSSProperties = {
    padding: '1px 8px 1px 0',
    whiteSpace: 'nowrap'
};

const numStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'right'
};


/**
 * Diagnostics on the two loaded glyphs, in a panel over the header's right
 * end (the header must be positioned, e.g. `position: relative`), with an
 * eye button to show / hide it:
 *
 * * skeleton length - the total over all of a glyph's components (MATs),
 *   in glyph units (in staggered mode, of the fine SAT the morph is drawn
 *   from)
 */
function DiagnosticsPanel(props: {
        show: boolean;
        onToggle: () => void;
        glyph1Name: string;
        glyph2Name: string;
        mats1: Mat[];
        mats2: Mat[] }) {

    const { show, onToggle, glyph1Name, glyph2Name, mats1, mats2 } = props;

    const len1 = useMemo(() => calcSkeletonLength(mats1), [mats1]);
    const len2 = useMemo(() => calcSkeletonLength(mats2), [mats2]);

    return <>
        {show &&
        <div style={panelStyle}>
            <table style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={cellStyle}></th>
                        <th style={numStyle}>{glyph1Name}</th>
                        <th style={numStyle}>{glyph2Name}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={cellStyle}>skeleton length</td>
                        <td style={numStyle}>{len1.toFixed(1)}</td>
                        <td style={numStyle}>{len2.toFixed(1)}</td>
                    </tr>
                </tbody>
            </table>
        </div>}
        <button
            onClick={onToggle}
            style={eyeStyle}
            title={show ? 'hide diagnostics' : 'show diagnostics'}
        >
            <EyeIcon open={show} />
        </button>
    </>;
}


/** An eye (`open`) or a struck-through eye. */
function EyeIcon(props: { open: boolean }) {
    return <svg
        width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="#555" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
    >
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
        {!props.open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>;
}


/** Returns the total skeleton length of the glyph's components. */
function calcSkeletonLength(
        mats: Mat[]): number {

    return mats.reduce((s, mat) => s + lenOfSegs$(segTreeFromCp(mat.cpNode)), 0);
}


export { DiagnosticsPanel }
