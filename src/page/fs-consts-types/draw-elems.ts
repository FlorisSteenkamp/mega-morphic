declare var _debug_: Debug;
import type { Mat } from 'flo-mat';
import {
    getBranches, getSatCulls, getHoleClosers,
    traverseVertices, isOneProng, isSharp, getRealProngCount,
    getProngCount
} from 'flo-mat';
import { getLeaves } from '../../../../mat/src/sat/get-leaves.js';
import { Debug } from '../../debug/debug.js';
import { ToDraw } from "../../state/to-draw.js";
import { deleteSvgs } from './delete-svgs.js';
import { drawLeaves } from '../../draw-elem/draw-leaves.js';
import { drawBranch } from '../../draw-elem/draw-branch.js';
import { drawCull } from '../../draw-elem/draw-cull.js';
import { drawMat } from '../../draw-elem/draw-mat.js';
import { drawOneProng } from '../../draw-elem/draw-one-prong.js';
import { drawTwoProng as createDrawTwoProng } from '../../draw-elem/draw-two-prong.js';
import { drawThreeProng } from '../../draw-elem/draw-three-prong.js';
import { vertex as drawVertex } from '../../draw-elem/draw-vertex.js';


const drawTwoProng = createDrawTwoProng(true, false);
const drawHoleCloser = createDrawTwoProng(false, false);


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

let ii=0;
async function drawElements(
        satScale: number,
        mats: Mat[],
        toDraws: ToDraw,
        svg$: SVGElement,
        $svgs: { [T in keyof ToDraw]: SVGElement[][] },
        viewbox: number[][]) {

    if (typeof _debug_ === 'undefined') { return; }

    // const svg$ = svgRef.current;
    const g = svg$.getElementsByTagName('g')[0];

    const vbWidth = (viewbox[1][0] - viewbox[0][0]);

    let num2Prongs = 0;
    const elemss$: SVGElement[][][] = [];
    for (const elemType_ in toDraws) {
        const elemType = elemType_ as keyof ToDraw;

        const toDraw = toDraws[elemType];

        const svgElems = $svgs[elemType] || [];
        deleteSvgs(svgElems);

        if (!toDraw) { continue; }

        for (const mat of mats) {
            if (elemType === 'holeCloser') {
                const holeClosers = getHoleClosers(mat.cpNode);
                for (const holeCloser of holeClosers) {
                    svgElems.push(drawHoleCloser(
                        g, holeCloser, 'thin10 cyan nofill', 0, vbWidth/10)
                    );
                }
            }

            if (elemType === 'cull') {
                const cullSet = getSatCulls(mat.cpNode, satScale);
                const culls = Array.from(cullSet)
                .flatMap(s => Array.from(s[1])
                .map(r => [s[0],r]));

                for (const cull of culls) {
                    svgElems.push(drawCull(
                        g, cull, 'thin10 cyan nofill', 0, vbWidth/10)
                    );
                }
            }

            if (elemType === 'leaves') {
                const leaves = getLeaves(mat.cpNode);
                svgElems.push(drawLeaves(g, leaves, undefined, 0, vbWidth/10));
            }

            if (elemType === 'mat') {
                svgElems.push(drawMat(g, mat, undefined, 0, vbWidth/10));
            }

            if (elemType === 'oneProng') {
                traverseVertices(mat.cpNode, cpNode => {
                    if (isOneProng(cpNode) && !isSharp(cpNode)) {
                        svgElems.push(drawOneProng(g, cpNode, undefined, 0, vbWidth/10))
                    }
                });
            }

            if (elemType === 'twoProng') {
                traverseVertices(mat.cpNode, cpNode => {
                    // if (getRealProngCount(cpNode) === 2) {
                    if (getProngCount(cpNode) === 2) {
                        svgElems.push(drawTwoProng(g, cpNode, undefined, 0, vbWidth/10))
                        num2Prongs++;
                    }
                });
            }

            if (elemType === 'threeProng') {
                traverseVertices(mat.cpNode, cpNode => {
                    if (getRealProngCount(cpNode) >= 3) {
                        svgElems.push(drawThreeProng(g, cpNode, undefined, 0, vbWidth/10))
                    }
                });
            }

            if (elemType === 'branch') {
                const branches = getBranches(mat.cpNode);
                let i = 0;
                for (const branch of branches) {
                    svgElems.push(drawBranch(
                        g, branch,
                        altClasses[i%5],
                        0
                    ));
                    i++;
                }
            }

            if (elemType === 'vertex') {
                traverseVertices(mat.cpNode, cpNode => {
                    svgElems.push(drawVertex(g, cpNode, undefined, 0, vbWidth/10))
                });
            }
        }

        ii = 0;
        elemss$.push(svgElems);
    }

    // console.log(`# 2-prongs: ${num2Prongs}`);

    return elemss$;
}


export { drawElements }
