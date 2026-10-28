import { memo, useState } from 'react';


interface Props {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    valueLabelDisplay?: 'auto' | 'on' | 'off';
    /** track/thumb accent and value-label color */
    color?: string;
    'aria-labelledby'?: string;
    onChange?: (value: number) => void;
}


const Slider = memo(function SimpleSlider(props: Props) {
    const {
        value, min = 0, max = 100, step = 1,
        valueLabelDisplay = 'off', color = '#1976d2', onChange,
    } = props;

    const [active, setActive] = useState(false);

    const percent = ((value - min) / (max - min)) * 100;
    const showLabel =
        valueLabelDisplay === 'on' ||
        (valueLabelDisplay === 'auto' && active);

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (onChange !== undefined) {
            onChange(Number(event.target.value));
        }
    }

    return (
        <div style={{ position: 'relative', padding: '6px 0' }}>
            {showLabel &&
                <span
                    style={{
                        position: 'absolute',
                        top: '-18px',
                        left: `${percent}%`,
                        transform: 'translateX(-50%)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        background: color,
                        color: '#fff',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {value}
                </span>
            }
            <input
                type="range"
                value={value}
                min={min}
                max={max}
                step={step}
                aria-labelledby={props['aria-labelledby']}
                onChange={handleChange}
                onMouseEnter={() => setActive(true)}
                onMouseLeave={() => setActive(false)}
                onFocus={() => setActive(true)}
                onBlur={() => setActive(false)}
                className="ui-range"
                style={{ '--c': color, '--p': `${percent}%` } as React.CSSProperties}
            />
        </div>
    );
});


export { Slider }
