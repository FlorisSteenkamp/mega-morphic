import type { FatBranch } from "./fat-branch/fat-branch.js";
import { drawFs } from 'flo-draw';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { getChainMatCurves } from './fat-branch/get-chain-mat-curves.js';


function drawFatBranchTree(
        g: SVGGElement,
        showDelay = 0,
        fatBranch: FatBranch,
        fullTree: boolean) {

    const { cpChain, pss } = fatBranch;

    // outline stroked + filled at 25% as ONE path (per-piece fills only
    // cover chords)
    drawBeziersAsSinglePath(g, pss, 'thin20 red fill25', showDelay);
    drawMatCurves(g, cpChain, 'red', showDelay);

    if (!fullTree) { return; }

    // Tree levels, each in its own color.
    const levelColors = [
        'green', 'orange', 'purple', 'cyan', 'deeppink', 'darkgreen', 'brown'
    ];
    let level = [fatBranch];
    for (let depth = 0; level.length > 0; depth++) {
        const color = levelColors[depth % levelColors.length];
        const children = level.flatMap(branch => branch.children);

        for (const branch of children) {
            drawBeziersAsSinglePath(
                g, branch.pss, `thin20 ${color} fill25`, showDelay);
            drawMatCurves(g, branch.cpChain, color, showDelay);
        }

        level = children;
    }
}


function drawMatCurves(
        g: SVGGElement,
        cpChain: FatBranch['cpChain'],
        color: string,
        showDelay?: number): void {

    getChainMatCurves(cpChain).forEach(ps => {
        drawFs.bezier(g, ps, `thin5 ${color} nofill`, showDelay);
    });
}


export { drawFatBranchTree }
