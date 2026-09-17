import { loadSvgFont } from "../../load-svg/load-svg-font.js";


const path = './fonts-test/achispado.svg';


const _font = loadSvgFont(path);


async function loadPath(glyphName: string) {
    const font = await _font;
    const pathStr = font.find(glyph => glyph.name === glyphName)!.d;

    return { pathStr };
}


async function getGlyphNames() {
    const font = await _font;

    return font.map(glyph => glyph.name);
}


export { loadPath, getGlyphNames }
