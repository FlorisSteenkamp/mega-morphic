import type { VectorSet } from "../../load-svg/vector-sets.js";
import { loadSvgFont } from "../../load-svg/load-svg-font.js";
import { vectorSets, vectorSetPath } from "../../load-svg/vector-sets.js";


const _fonts = Promise.all(
    vectorSets.map(set => loadSvgFont(`./${vectorSetPath(set)}`))
);


/** The glyph's SVG path string. */
async function loadPath(glyphName: string): Promise<string> {
    const fonts = await _fonts;

    return fonts.flat().find(glyph => glyph.name === glyphName)!.d;
}


/** Returns the glyph names per vector set. */
async function getGlyphNames(): Promise<Record<VectorSet, string[]>> {
    const fonts = await _fonts;

    return Object.fromEntries(vectorSets.map((set, i) =>
        [set, fonts[i].map(glyph => glyph.name)]
    )) as Record<VectorSet, string[]>;
}


export { loadPath, getGlyphNames }
