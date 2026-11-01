import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSvgFont } from '../../src/load-svg/load-svg-font.js';
import { vectorSets, vectorSetPath } from '../../src/load-svg/vector-sets.js';


/** Returns the glyphs of all the vector sets. */
function readVectors() {
    return vectorSets.flatMap(set =>
        parseSvgFont(readFileSync(resolve(vectorSetPath(set)), 'utf-8')));
}


export { readVectors }
