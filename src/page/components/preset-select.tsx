import type { GlyphPreset } from '../../state/glyph-preset.js';
import { useState, useRef, useEffect } from 'react';


interface Props {
    readonly presets: readonly GlyphPreset[];
    readonly glyph1Name: string;
    readonly glyph2Name: string;
    readonly onSelected: (preset: GlyphPreset) => void;
    readonly onAdded: (preset: GlyphPreset) => void;
    readonly onDeleted: (idx: number) => void;
}


/** Returns the preset's display label, e.g. `M → N`. */
function getPresetLabel(
        preset: GlyphPreset) {

    return `${preset[0]} → ${preset[1]}`;
}


/** Returns true if the preset is exactly the given glyph pair. */
function isPresetOf(
        glyph1Name: string,
        glyph2Name: string,
        preset: GlyphPreset) {

    return preset[0] === glyph1Name && preset[1] === glyph2Name;
}


/** A small trash-bin icon. */
function TrashIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
            <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
        </svg>
    );
}


/**
 * A dropdown of glyph-pair presets, styled like `SimpleSelect`. Each preset
 * has a trash button (deletes after confirmation) and the last row adds the
 * current glyph pair as a new preset. Closes on outside click or Escape.
 */
function PresetSelect(
        props: Props) {

    const { presets, glyph1Name, glyph2Name, onSelected, onAdded, onDeleted } = props;

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(function() {
        if (!open) { return; }

        function onDocMouseDown(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') { setOpen(false); }
        }

        document.addEventListener('mousedown', onDocMouseDown);
        document.addEventListener('keydown', onKeyDown);
        return function() {
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const current: GlyphPreset = [glyph1Name, glyph2Name];
    const currentIdx = presets.findIndex(p => isPresetOf(glyph1Name, glyph2Name, p));
    const isCurrentSaved = currentIdx !== -1;

    function select(preset: GlyphPreset) {
        setOpen(false);
        onSelected(preset);
    }

    function del(
            e: React.MouseEvent,
            idx: number) {

        e.stopPropagation();
        const ok = window.confirm(
            `Are you sure you want to delete the preset ${getPresetLabel(presets[idx])}?`
        );
        if (ok) { onDeleted(idx); }
    }

    function add() {
        if (isCurrentSaved) { return; }
        onAdded(current);
    }

    return (
        <div
            ref={rootRef}
            style={{
                position: 'relative',
                display: 'inline-block',
                textAlign: 'left',
                verticalAlign: 'middle',
                minWidth: '150px',
            }}
        >
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    height: 'var(--ui-height)',
                    padding: '0 10px 0 12px',
                    background: 'var(--ui-surface)',
                    border: `1px solid ${open ? 'var(--ui-accent)' : 'var(--ui-border)'}`,
                    borderRadius: 'var(--ui-radius)',
                    boxShadow: open ? '0 0 0 3px var(--ui-accent-weak)' : 'none',
                    color: isCurrentSaved ? 'var(--ui-text)' : 'var(--ui-muted)',
                    cursor: 'pointer',
                    font: 'inherit',
                    boxSizing: 'border-box',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isCurrentSaved ? getPresetLabel(presets[currentIdx]) : 'presets'}
                </span>
                <span
                    style={{
                        fontSize: '8px',
                        lineHeight: 1,
                        color: 'var(--ui-muted)',
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform .15s ease',
                    }}
                >
                    ▼
                </span>
            </button>
            {open &&
                <ul
                    role="listbox"
                    style={{
                        position: 'absolute',
                        zIndex: 10,
                        left: 0,
                        minWidth: '100%',
                        margin: '4px 0 0',
                        padding: '4px 0',
                        listStyle: 'none',
                        maxHeight: `${20 * 30}px`,
                        overflowY: 'auto',
                        background: 'var(--ui-surface)',
                        border: '1px solid var(--ui-border)',
                        borderRadius: 'var(--ui-radius)',
                        boxShadow: '0 8px 24px rgba(16, 24, 40, .12)',
                        boxSizing: 'border-box',
                    }}
                >
                    {presets.map((preset, idx) =>
                        <PresetRow
                            key={getPresetLabel(preset)}
                            preset={preset}
                            selected={idx === currentIdx}
                            onClick={() => select(preset)}
                            onDelete={e => del(e, idx)}
                        />
                    )}
                    <li
                        role="option"
                        aria-disabled={isCurrentSaved}
                        onClick={add}
                        style={{
                            padding: '6px 12px',
                            lineHeight: '18px',
                            whiteSpace: 'nowrap',
                            borderTop: presets.length > 0 ? '1px solid var(--ui-divider)' : 'none',
                            marginTop: presets.length > 0 ? '4px' : 0,
                            cursor: isCurrentSaved ? 'default' : 'pointer',
                            color: isCurrentSaved ? '#aaa' : 'var(--ui-accent)',
                        }}
                    >
                        + add {getPresetLabel(current)}
                    </li>
                </ul>
            }
        </div>
    );
}


/** A single preset row: label plus a trash button. */
function PresetRow(
        props: {
            readonly preset: GlyphPreset;
            readonly selected: boolean;
            readonly onClick: () => void;
            readonly onDelete: (e: React.MouseEvent) => void;
        }) {

    const { preset, selected, onClick, onDelete } = props;

    const [hover, setHover] = useState(false);

    return (
        <li
            role="option"
            aria-selected={selected}
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '6px 6px 6px 12px',
                lineHeight: '18px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: selected
                    ? 'var(--ui-accent-weak)'
                    : hover ? 'var(--ui-hover)' : 'transparent',
                color: selected ? 'var(--ui-accent)' : 'var(--ui-text)',
                fontWeight: selected ? 500 : 400,
            }}
        >
            {getPresetLabel(preset)}
            <button
                type="button"
                title="Delete preset"
                onClick={onDelete}
                style={{
                    display: 'flex',
                    padding: '2px',
                    border: 'none',
                    background: 'transparent',
                    color: '#b0413e',
                    cursor: 'pointer',
                    opacity: hover ? 1 : 0.45,
                }}
            >
                <TrashIcon />
            </button>
        </li>
    );
}


export { PresetSelect }
