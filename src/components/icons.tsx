/** a 16px stroked icon on a 24-unit grid */
function Icon(
        props: { readonly children: React.ReactNode }) {

    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {props.children}
        </svg>
    );
}


function PlayIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" />
        </svg>
    );
}

function PauseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
        </svg>
    );
}

function RotateIcon() {
    return <Icon>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
    </Icon>;
}

function FlipHIcon() {
    return <Icon>
        <path d="M12 3v18" strokeDasharray="2 3" />
        <path d="M8 7l-5 5 5 5V7z" />
        <path d="M16 7l5 5-5 5V7z" />
    </Icon>;
}

function FlipVIcon() {
    return <Icon>
        <path d="M3 12h18" strokeDasharray="2 3" />
        <path d="M7 8l5-5 5 5H7z" />
        <path d="M7 16l5 5 5-5H7z" />
    </Icon>;
}

function ZoomOutIcon() {
    return <Icon>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M8 11h6" />
    </Icon>;
}

function ArrowRightIcon() {
    return <Icon>
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
    </Icon>;
}

function SlidersIcon() {
    return <Icon>
        <path d="M4 6h10" /><path d="M18 6h2" /><circle cx="16" cy="6" r="2" />
        <path d="M4 12h4" /><path d="M12 12h8" /><circle cx="10" cy="12" r="2" />
        <path d="M4 18h12" /><path d="M20 18h0" /><circle cx="18" cy="18" r="2" />
    </Icon>;
}


export {
    PlayIcon, PauseIcon, RotateIcon, FlipHIcon, FlipVIcon, ZoomOutIcon,
    ArrowRightIcon, SlidersIcon
}
