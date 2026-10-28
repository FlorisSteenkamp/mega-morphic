import type { PoseRamp } from '../procrustes/pose-ramp.js';
import { calcPoseOnRamp } from '../procrustes/pose-ramp.js';
import { XMLNS } from '../../draw/xmlns.js';


/** the fill pattern's and the glow filter's ids (one morph view per page) */
const ID = 'morphing-fill';
const GLOW_ID = 'morphing-fill-glow';

/** the pattern's tile size, as a fraction of the glyph's scale (√area) */
const TILE = 0.06;
/** the dots' / lines' width, as a fraction of the tile */
const WIDTH = 0.4;
/** the lines' angle at t = 1 (degrees; the dots' grid is unrotated at 0) */
const ANGLE = 45;

/** the neon ink's hue at t = 0 (hot pink) and t = 1 (cyan), via violet */
const HUE_A = 320;
const HUE_B = 180;
/** the view's background behind the glyph (`drawMorph`) */
const VIEW_BACKGROUND = '#262626';
/** the paper: a deep tone of the ink's hue turned by this (degrees), so
 *  the glyph stands out from the view's background and its colors morph
 *  too */
const PAPER_HUE_SHIFT = 40;
/** the paper's saturation and lightness (%) */
const PAPER_SAT = 70;
const PAPER_LIGHT = 16;
/** the ink's saturation and lightness (%) */
const INK_SAT = 70;
const INK_LIGHT = 58;
/** the glow's blur radius, as a fraction of the tile (0: none - sharp) */
const GLOW = 0;


/**
 * Adds to the group the fill pattern of the morph at `t` and its glow, and
 * returns the fill and filter to give a shape (`url(#…)`s): a neon texture
 * that morphs along with the glyph.
 *
 * * round dots at `t` = 0 stretch into dashes and join into continuous
 *   lines at `t` = 1, turning from 0° to `ANGLE` on the way - one tile
 *   whose dash length and angle are lerped
 *
 * * the ink's hue goes from `HUE_A` to `HUE_B`, on paper of a deep tone
 *   of a neighbouring hue - meant for a dark view (`VIEW_BACKGROUND`); with
 *   `GLOW` > 0, a soft glow (the texture blurred under itself)
 *
 * * the texture rides the glyph: the tile is placed at the morph's pose
 *   on its path (`calcPoseOnRamp` - the centroid and scale the drawn shape
 *   is pinned to) and sized by its scale, so it moves and grows with the
 *   shape instead of the shape sliding over it - the glow too
 *
 * @param g the group to add the pattern to (redrawn every frame)
 * @param t the morph parameter
 * @param ramp the morph's pose path
 */
function addMorphingFill(
        g: SVGGElement,
        t: number,
        ramp: PoseRamp): { fill: string; filter: string } {

    const { centroid: [cx, cy], scale } = calcPoseOnRamp(ramp, t);
    const tile = TILE*scale;
    const hue = calcHue(t);
    const ink = calcMorphColor(t);
    const paper = `hsl(${hue + PAPER_HUE_SHIFT}, ${PAPER_SAT}%, ${PAPER_LIGHT}%)`;

    // the dash, centred in its unit tile: a dot at t = 0, the tile's full
    // width at t = 1 (its round caps clipped by the tile: a continuous line)
    const half = t/2;

    const $pattern = createSvgElement('pattern', {
        id: ID,
        patternUnits: 'userSpaceOnUse',
        width: 1,
        height: 1,
        patternTransform:
            `translate(${cx} ${cy}) rotate(${ANGLE*t}) scale(${tile})`
    });
    $pattern.append(
        createSvgElement('rect', {
            x: 0, y: 0, width: 1, height: 1, fill: paper
        }),
        createSvgElement('line', {
            x1: 0.5 - half, y1: 0.5, x2: 0.5 + half, y2: 0.5,
            stroke: ink, 'stroke-width': WIDTH, 'stroke-linecap': 'round'
        })
    );

    const $defs = createSvgElement('defs', {});
    $defs.append($pattern);
    g.append($defs);

    const fill = `url(#${ID})`;
    if (GLOW === 0) { return { fill, filter: 'none' }; }

    // the glow: the textured shape blurred, under itself
    const $glow = createSvgElement('filter', {
        id: GLOW_ID, x: '-10%', y: '-10%', width: '120%', height: '120%'
    });
    const $merge = createSvgElement('feMerge', {});
    $merge.append(
        createSvgElement('feMergeNode', { in: 'blur' }),
        createSvgElement('feMergeNode', { in: 'SourceGraphic' })
    );
    $glow.append(
        createSvgElement('feGaussianBlur', {
            in: 'SourceGraphic', stdDeviation: GLOW*tile, result: 'blur'
        }),
        $merge
    );

    $defs.append($glow);

    return { fill, filter: `url(#${GLOW_ID})` };
}


/**
 * Returns the morph's color at `t`: from `HUE_A` to `HUE_B` - the
 * texture's ink (`addMorphingFill`), and the solid fill when there is no
 * texture.
 */
function calcMorphColor(t: number): string {
    return `hsl(${calcHue(t)}, ${INK_SAT}%, ${INK_LIGHT}%)`;
}


/** Returns the morph's hue at `t` (degrees). */
function calcHue(t: number): number {
    return HUE_A + t*(HUE_B - HUE_A);
}


/** Returns a new SVG element with the given attributes. */
function createSvgElement(
        tag: string,
        attrs: Record<string, string | number>): SVGElement {

    const $el = document.createElementNS(XMLNS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        $el.setAttributeNS(null, k, `${v}`);
    }

    return $el;
}


export { addMorphingFill, calcMorphColor, VIEW_BACKGROUND }
