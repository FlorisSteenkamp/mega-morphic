import { AppState } from './app-state';
import { defaultAppState, defaultDeduced } from './default-state';


function getInitialState(): AppState {
    let appStateJson = localStorage.getItem('app-state');
    if (!appStateJson) { return defaultAppState; }

    let storedState: AppState = JSON.parse(appStateJson);
    if (storedState.version !== defaultAppState.version) {
        return defaultAppState;
    }

    // `deduced` (cyclic, huge) must stay the LAST key: getObjPath walks
    // pageState in key order with no cycle guard, so update targets must be
    // found before it ever recurses into `deduced`.
    const { deduced: _, ...pageStateDefaults } = defaultAppState.pageState;

    return { 
        ...storedState, 
        pageState: { 
            // Defaults first so fields added since the state was stored exist
            ...pageStateDefaults,
            ...storedState.pageState,
            // likewise for weights added since
            pathWeights: {
                ...pageStateDefaults.pathWeights,
                ...storedState.pageState.pathWeights
            },
            deduced: defaultDeduced
        } 
    };
}


export { getInitialState }
