import { DebugElems } from '../debug/debug.js';


type ToDraw = { [T in keyof DebugElems]: boolean };


export { ToDraw }
