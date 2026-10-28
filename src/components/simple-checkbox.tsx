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

    function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (onChanged !== undefined) {
            onChanged(event.target.checked);
        }
    }

    return (
        <label className="ui-check" style={styles ? styles.div : undefined}>
            <input type="checkbox" onChange={onChange} checked={checked} />
            {text}
        </label>
    );
});


export type { CheckboxStyles }
export { Checkbox }
