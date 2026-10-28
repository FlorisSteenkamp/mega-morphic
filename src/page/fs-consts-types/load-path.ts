import { loadSvgFont } from "../../load-svg/load-svg-font.js";


const path = './fonts-test/vectors.svg';


const _font = loadSvgFont(path);


/** The glyph's SVG path string. */
async function loadPath(glyphName: string): Promise<string> {
    const font = await _font;

    return font.find(glyph => glyph.name === glyphName)!.d;
}


async function getGlyphNames() {
    const font = await _font;

    return font.map(glyph => glyph.name);
}


export { loadPath, getGlyphNames }
