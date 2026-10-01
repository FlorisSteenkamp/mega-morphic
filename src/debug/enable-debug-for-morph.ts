import type { Debug } from './debug.js';


function enableDebugForMorph(debugOn: boolean) {
    if (!debugOn) { 
        (window as any)._debug_ = undefined; 
        return;
    }

    let debug: Debug = (window as any)._debug_;

    debug = { 
        ...debug, 
        elems: { 
            ...debug?.elems,
            pathMatchResult: []
        },
        timing: {
            ...debug?.timing,
        },
        fs: {
            ...debug?.fs
        },
        directives: {
            ...debug?.directives,
        }
    };

    (window as any)._debug_ = debug;
}


export { enableDebugForMorph }
