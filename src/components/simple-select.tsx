import { useState, useRef, useEffect } from 'react';

const { min, max } = Math;


interface Props {
    readonly label?: string;
    readonly value: string;
    readonly options: readonly string[];
    readonly style?: React.CSSProperties;
    readonly onChanged?: (value: string) => void;
}


/**
 * A minimal, dependency-free dropdown select styled to match the demo's
 * button-group theme. Closes on outside click or Escape.
 */
function SimpleSelect(props: Props) {
    const { label, value, options, style, onChanged } = props;

    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

    useEffect(() => {
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
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    // Keep the keyboard-highlighted option scrolled into view.
    useEffect(() => {
        if (open && activeIndex >= 0) {
            optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [open, activeIndex]);

    function openDropdown() {
        setActiveIndex(max(0, options.indexOf(value)));
        setOpen(true);
    }

    function toggleOpen() {
        if (open) { setOpen(false); } else { openDropdown(); }
    }

    function select(option: string) {
        setOpen(false);
        if (onChanged && option !== value) { onChanged(option); }
    }

    // Type-ahead: jump the highlight to the next option whose first letter
    // matches `char`, cycling from the current position (so pressing the same
    // letter repeatedly steps through all matches).
    function typeAhead(char: string) {
        const c = char.toLowerCase();
        const n = options.length;
        if (n === 0) { return; }
        const start = activeIndex >= 0 ? activeIndex : options.indexOf(value);
        for (let k = 1; k <= n; k++) {
            const idx = (start + k) % n;
            if (options[idx].toLowerCase().startsWith(c)) {
                setActiveIndex(idx);
                return;
            }
        }
    }

    function onButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' ||
                e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDropdown();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(i => min(options.length - 1, i + 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(i => max(0, i - 1));
                break;
            case 'Home':
                e.preventDefault();
                setActiveIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setActiveIndex(options.length - 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (activeIndex >= 0) { select(options[activeIndex]); }
                break;
            case 'Escape':
                setOpen(false);
                break;
            default:
                // Type-ahead on a single printable character (ignore shortcuts).
                if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    typeAhead(e.key);
                }
                break;
        }
    }

    return (
        <div
            ref={rootRef}
            style={{
                position: 'relative',
                display: 'inline-block',
                textAlign: 'left',
                verticalAlign: 'middle',
                minWidth: '220px',
                ...style,
            }}
        >
            {label !== undefined &&
                <div style={{ fontSize: '11px', color: '#5a5a5a', marginBottom: '3px' }}>
                    {label}
                </div>
            }
            <button
                type="button"
                onClick={toggleOpen}
                onKeyDown={onButtonKeyDown}
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
                    color: 'var(--ui-text)',
                    cursor: 'pointer',
                    font: 'inherit',
                    boxSizing: 'border-box',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value}
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
                        right: 0,
                        margin: '4px 0 0',
                        padding: '4px 0',
                        listStyle: 'none',
                        maxHeight: `${20 * 30}px`,
                        overflowY: 'auto',
                        background: 'var(--ui-surface)',
                        border: '1px solid var(--ui-border)',
                        borderRadius: 'var(--ui-radius)',
                        boxShadow: '0 8px 24px rgba(16, 24, 40, .12)',
                    }}
                >
                    {options.map((option, idx) => {
                        const selected = option === value;
                        const active = idx === activeIndex;
                        return (
                            <li
                                key={option}
                                ref={el => { optionRefs.current[idx] = el; }}
                                role="option"
                                aria-selected={selected}
                                onClick={() => select(option)}
                                onMouseEnter={() => setActiveIndex(idx)}
                                style={{
                                    padding: '6px 12px',
                                    lineHeight: '18px',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    background: selected
                                        ? 'var(--ui-accent-weak)'
                                        : active ? 'var(--ui-hover)' : 'transparent',
                                    color: selected ? 'var(--ui-accent)' : 'var(--ui-text)',
                                    fontWeight: selected ? 500 : 400,
                                }}
                            >
                                {option}
                            </li>
                        );
                    })}
                </ul>
            }
        </div>
    );
}


export { SimpleSelect }
