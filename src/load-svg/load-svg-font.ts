import * as cheerio from 'cheerio';


interface Glyph {
    name: string;
    d: string;
}


function parseSvgFont(data: string): Glyph[] {
    const $ = cheerio.load(data, { xmlMode: true });
    const $svgs = $('glyph');

    const glyphs: Glyph[] = [];
    for (let i=0; i<$svgs.length; i++) {
        const $glyph = $svgs[i];
        const attribs = $glyph.attribs;
        glyphs.push({
            name: attribs["glyph-name"],
            d: attribs.d
        })
    }

    return glyphs;
}


async function loadSvgFont(path: string) {
    const data = await (await fetch(path)).text();

    return parseSvgFont(data);
}


export { loadSvgFont, parseSvgFont }
