import { PageState } from "./page-state.js";


/**
 * The App state - transient properties won't be saved in local storage
 */
interface AppState {
    /** The state version */
    version: number;
    pageState: PageState;
}


export { AppState }
