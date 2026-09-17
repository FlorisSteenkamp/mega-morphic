import * as React from 'react';


interface Props<T extends string> {
    readonly options: { [K in T]?: { text: string } };
    /** undefined = nothing selected */
    readonly value: T | undefined;
    readonly onChanged?: (key: T | undefined) => void;
}


function ButtonGroup<T extends string>(props: Props<T>) {
    const { options, onChanged, value: selectedValue } = props;
    const idStr = Math.random().toString();

    function onClick(key: T) {
        return (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            if (!onChanged) { return; }
            // Clicking the selection again deselects.
            onChanged(key === selectedValue ? undefined : key);
        }
    }

    return (
        <div className='btn-group'>
            {Object.entries(options).map(option => {
                const key = option[0] as T;
                const value = option[1] as { text: string };
                // return <button key={key} onClick={onClick(key)}>{value.text}</button>
                return (
                    <button 
                        key={key} 
                        onClick={onClick(key)}
                        style={selectedValue === key ? { backgroundColor: '#3e8e41' } : {} }
                    >
                        {value.text}
                    </button>
                );
            })}
        </div>
    );
}


export { ButtonGroup }
    