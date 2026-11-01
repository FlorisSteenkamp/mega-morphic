import { toDrawKeyToText } from '../page/fs-consts-types/to-draw-key-to-text.js';


/** a drawable debug element (see `toDrawKeyToText`) */
type ToDrawKey = keyof typeof toDrawKeyToText;

/** which debug elements to draw */
type ToDraw = Record<ToDrawKey, boolean>;

/** all drawable debug elements, in display order */
const toDrawKeys = Object.keys(toDrawKeyToText) as ToDrawKey[];

/** the debug elements offered as checkboxes, in display order */
const shownToDrawKeys: readonly ToDrawKey[] = [
    'leaves',
    // hidden to declutter - re-enable as needed
    // 'oneProng',
    'twoProng',
    'threeProng',
    'vertex',
    'mat',
    'matNoHoles',
    // 'cull',
    // 'branch',
    'holeCloser',
    'match',
    'matchHoles',
    'vertexNums'
];


export type { ToDraw, ToDrawKey }
export { toDrawKeys, shownToDrawKeys }
