import { toDrawKeyToText } from '../page/fs-consts-types/to-draw-key-to-text.js';


/** a drawable debug element (see `toDrawKeyToText`) */
type ToDrawKey = keyof typeof toDrawKeyToText;

/** which debug elements to draw */
type ToDraw = Record<ToDrawKey, boolean>;

/** all drawable debug elements, in display order */
const toDrawKeys = Object.keys(toDrawKeyToText) as ToDrawKey[];


export type { ToDraw, ToDrawKey }
export { toDrawKeys }
