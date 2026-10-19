import type * as React from 'react';


const btnStyleBlue: React.CSSProperties = {
    padding: '9px 20px',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '1',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#fff',               // unflipped
    backgroundColor: '#1976d2',  // ...
    border: 'none',                // ...
}


const btnStyleBlueFlipped: React.CSSProperties = {
    ...btnStyleBlue,
    color: '#1976d2',             // flipped
    backgroundColor: '#fff',      // ...
    border: '1px solid #1976d2',  // ...
}


/**
 * A blue toggle button's style: filled when `on`, outlined when off.
 *
 * @param on whether the toggle is on
 * @param small the smaller variant (weights row: smaller padding and font,
 * bottom margin)
 */
function toggleBtnStyle(on: boolean, small: boolean): React.CSSProperties {
    return {
        padding: small ? '6px 12px' : '9px 14px',
        fontSize: small ? '13px' : '14px',
        fontWeight: 500,
        lineHeight: '1',
        color: on ? '#fff' : '#1976d2',
        backgroundColor: on ? '#1976d2' : '#fff',
        border: '1px solid #1976d2',
        borderRadius: '4px',
        cursor: 'pointer',
        ...(small ? { marginBottom: '8px' } : {})
    };
}


export { btnStyleBlue, btnStyleBlueFlipped, toggleBtnStyle }
