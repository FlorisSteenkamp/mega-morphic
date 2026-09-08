import * as React from 'react';
import type { StateControl } from './state-control/state-control.js';
import type { State } from './state/state.js';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { _upd } from './state-control/upd.js';
import { getInitialState } from './state/get-initial-state.js';
import { defaultTransientState } from './state/default-state.js';
import { Page } from './page/page.js';


function App() {
    const [appState, setAppState] = useState(getInitialState);
    const [state] = useState((): State => ({ appState }));
    const [{upd, upd$}] = useState(() => _upd(state, setAppState));
    const [stateControl] = useState((): StateControl => ({ 
        state, upd, upd$, transientState: defaultTransientState,
    }));

    const { pageState } = appState;

    return (
        <main>
            <Page stateControl={stateControl} pageState={pageState} />
        </main>
    );
}


const container = document.getElementById('app');
const root = createRoot(container!);
root.render(<App />);
