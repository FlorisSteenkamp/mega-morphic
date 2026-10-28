/** A labelled group of controls on the toolbar (divided from the previous). */
function ToolGroup(
        props: {
            readonly label: string;
            readonly children: React.ReactNode;
        }) {

    const { label, children } = props;

    return (
        <div className="ui-group">
            <div className="ui-group-label">{label}</div>
            <div className="ui-group-body">{children}</div>
        </div>
    );
}


/** A labelled row of the debug panel. */
function DebugRow(
        props: {
            readonly label: string;
            readonly children: React.ReactNode;
        }) {

    const { label, children } = props;

    return (
        <div className="ui-debug-row">
            <div className="ui-group-label">{label}</div>
            <div className="ui-debug-body">{children}</div>
        </div>
    );
}


/** Returns a button's class: `ui-btn`, the extra classes and, if on, `is-on`. */
function getBtnClass(
        on: boolean,
        extra: string) {

    return `ui-btn ${extra}${on ? ' is-on' : ''}`;
}


export { ToolGroup, DebugRow, getBtnClass }
