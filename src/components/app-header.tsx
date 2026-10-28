const REPO_URL = 'https://github.com/FlorisSteenkamp/mega-morphic';
const HIRE_URL = 'mailto:steenkampfloris@gmail.com?subject=Morphing';


/** The logo: a circle part-way to becoming a square, pink → cyan like the morph fill. */
function Logo() {
    return (
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
                <linearGradient id="app-logo-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ff4fa3" />
                    <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
            </defs>
            <rect x="3" y="3" width="26" height="26" rx="9" fill="url(#app-logo-grad)" />
            <circle cx="16" cy="16" r="5" fill="#0f172a" />
        </svg>
    );
}


/** The app's title band: logo, name, tagline and links. */
function AppHeader() {
    return (
        <header className="app-header">
            <Logo />
            <div className="app-header-titles">
                <h1 className="app-header-title">Mega-morphic</h1>
                <div className="app-header-tagline">
                    Shapes morphed through their skeletons: strokes bend,
                    branches grow and holes open or close.
                </div>
            </div>
            <nav className="app-header-links">
                <a href={REPO_URL} target="_blank" rel="noopener">GitHub</a>
                <a href={HIRE_URL} className="app-header-cta">Hire me</a>
            </nav>
        </header>
    );
}


export { AppHeader }
