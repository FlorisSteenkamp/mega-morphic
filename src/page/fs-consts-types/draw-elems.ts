declare var _debug_: Debug;
import type { Mat } from 'flo-mat';
import {
    getBranches, getSatCulls, getHoleClosers,
    traverseVertices, isOneProng, isSharp, getRealProngCount,
    getProngCount
} from 'flo-mat';
import { getLeaves } from 'flo-mat';
import { Debug } from '../../debug/debug.js';
import type { ToDraw } from "../../state/to-draw.js";
import type { GeneratedSvgs } from './create-empty-generated-svgs.js';
import { toDrawKeys } from "../../state/to-draw.js";
import { deleteSvgs } from './delete-svgs.js';
import { drawLeaves } from '../../draw-elem/draw-leaves.js';
import { drawFs } from 'flo-draw';
import { drawBranch } from '../../draw-elem/draw-branch.js';
import { drawMat } from '../../draw-elem/draw-mat.js';
import { drawOneProng } from '../../draw-elem/draw-one-prong.js';
import { drawTwoProng as createDrawTwoProng } from '../../draw-elem/draw-two-prong.js';
import { drawThreeProng } from '../../draw-elem/draw-three-prong.js';
import { drawVertex } from '../../draw-elem/draw-vertex.js';
import { getG } from '../../draw/get-g.js';


const drawTwoProng = createDrawTwoProng(true);
const drawHoleCloser = createDrawTwoProng(false);


const altClasses = [
    'thin10 blue nofill',
    'thin10 red nofill',
    'thin10 darkgreen nofill',
    'thin10 deeppink nofill',
    'thin10 brown nofill',
];


const colors = [
    '#E65100', '#33691E', '#01579B', '#4A148C', '#B71C1C',
    '#880E4F', '#1A237E', '#004D40',
    '#F57F17', '#3E2723'
].map(color => color + '33');


function drawElements(
        satScale: number,
        mats: Mat[],
        toDraws: ToDraw,
        svg$: SVGElement,
        $svgs: GeneratedSvgs,
        viewbox: number[][]): void {

    if (typeof _debug_ === 'undefined') { return; }

    // const svg$ = svgRef.current;
    const g = getG(svg$);

    const vbWidth = (viewbox[1][0] - viewbox[0][0]);

    // (the key list, not `toDraws`' own keys - a saved state may carry
    // stale ones)
    for (const elemType of toDrawKeys) {
        // the match's overlays are drawn by `drawOverlay`
        if (elemType === 'match' || elemType === 'vertexNums') { continue; }

        const toDraw = toDraws[elemType];

        const svgElems = $svgs[elemType] || [];
        deleteSvgs(svgElems);

        if (!toDraw) { continue; }

        for (const mat of mats) {
            if (elemType === 'holeCloser') {
                const holeClosers = getHoleClosers(mat.cpNode);
                for (const holeCloser of holeClosers) {
                    svgElems.push(drawHoleCloser(g, holeCloser, 0, vbWidth/10));
                }
            }

            if (elemType === 'cull') {
                const cullSet = getSatCulls(mat.cpNode, satScale);
                const culls = Array.from(cullSet, c => c.center);

                for (const cull of culls) {
                    svgElems.push(drawFs.crossHair(
                        g, cull, 'thin10 cyan nofill', 0.1*vbWidth/10)
                    );
                }
            }

            if (elemType === 'leaves') {
                const leaves = getLeaves(mat.cpNode);
                svgElems.push(drawLeaves(g, leaves, 0, vbWidth/10));
            }

            if (elemType === 'mat') {
                svgElems.push(drawMat(g, mat));
            }

            if (elemType === 'oneProng') {
                traverseVertices(mat.cpNode, cpNode => {
                    if (isOneProng(cpNode) && !isSharp(cpNode)) {
                        svgElems.push(drawOneProng(g, cpNode, 0, vbWidth/10))
                    }
                });
            }

            if (elemType === 'twoProng') {
                traverseVertices(mat.cpNode, cpNode => {
                    if (getProngCount(cpNode) === 2) {
                        svgElems.push(drawTwoProng(g, cpNode, 0, vbWidth/10))
                    }
                });
            }

            if (elemType === 'threeProng') {
                traverseVertices(mat.cpNode, cpNode => {
                    if (getRealProngCount(cpNode) >= 3) {
                        svgElems.push(drawThreeProng(g, cpNode, 0, vbWidth/10))
                    }
                });
            }

            if (elemType === 'branch') {
                const branches = getBranches(mat.cpNode);
                let i = 0;
                for (const branch of branches) {
                    svgElems.push(drawBranch(g, branch, altClasses[i%5]));
                    i++;
                }
            }

            if (elemType === 'vertex') {
                traverseVertices(mat.cpNode, cpNode => {
                    svgElems.push(drawVertex(g, cpNode, 0, vbWidth/10))
                });
            }
        }
    }
}


export { drawElements }
