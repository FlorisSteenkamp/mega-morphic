import { loadSvgFont } from "../../load-svg/load-svg-font.js";


// const path = './fonts-test/alligators.svg';
const path = './fonts-test/achispado.svg';
// const path = './fonts-test/anlinear.svg';
// const path = './fonts-test/aquinas.svg';


// const path = './fonts/ff_alega_serif-167370729.svg';
// const path = './fonts/Quicksand-Regular.svg';
// const path = './fonts/Helvetica-Roman.svg';
// const path = './fonts/Mainsthen.svg';


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
