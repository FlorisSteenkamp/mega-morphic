import { DebugElems } from '../debug.js';


type ToDraw = { [T in keyof DebugElems]: boolean };


export { ToDraw }
