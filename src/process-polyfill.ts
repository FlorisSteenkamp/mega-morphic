/**
 * Installs a minimal `process` in the browser, so experiment flags read as
 * `process.env.NAME === '1'` work in the app as they do under node (jest):
 * `process.env` holds the page URL's query parameters, e.g.
 * `index.html?RETRACT_BOTH=1`.
 *
 * * called (not just imported) from the app entry: the bundle treats every
 *   module as side-effect free, so an import alone would be dropped
 *
 * * does nothing under node, where `process` exists
 */
function installProcessPolyfill(): void {
    const g = globalThis as { process?: { env: Record<string, string> } };
    if (g.process !== undefined) { return; }

    g.process = {
        env: Object.fromEntries(new URLSearchParams(globalThis.location?.search ?? ''))
    };
}


export { installProcessPolyfill }
