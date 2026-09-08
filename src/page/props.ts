import type { StateControl } from "../state-control/state-control";
import type { PageState } from "../state/page-state";


interface Props {
    readonly stateControl: StateControl;
    readonly pageState: PageState;
}


export { Props }
