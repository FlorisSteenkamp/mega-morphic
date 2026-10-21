import { memo } from 'react';


interface CheckboxStyles {
    readonly div: React.CSSProperties
}


interface Props {
    text: string;
    styles?: CheckboxStyles,
    checked: boolean;
    onChanged?: (checked: boolean) => void;
}


const Checkbox = memo(function(props: Props) {
    const { styles, text, onChanged, checked } = props;
    const idStr = Math.random().toString();

    function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (onChanged !== undefined) {
            onChanged(event.target.checked);
        }
    }

    return (
        <div style={styles ? styles.div : undefined}>
            <input type="checkbox" id={idStr} onChange={onChange} checked={checked} />
            <label htmlFor={idStr}>{text}</label>
        </div>
    );
});


export type { CheckboxStyles }
export { Checkbox }
