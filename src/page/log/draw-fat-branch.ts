import type { FatBranch } from "../../morph/fat-branch/fat-branch.js";
import { drawFs } from 'flo-draw';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { getChainMatCurves } from '../../morph/fat-branch/get-chain-mat-curves.js';


function drawFatBranchTree(
        g: SVGGElement,
        showDelay = 0,
        fatBranch: FatBranch,
        fullTree: boolean,
        logit = false) {

    if (fatBranch === undefined) { return; }

    if (logit) { console.log(fatBranch); }

    const { cpChain, pss } = fatBranch;

    drawOutline(g, pss, 'red', showDelay);
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
            drawOutline(g, branch.pss, color, showDelay);
            drawMatCurves(g, branch.cpChain, color, showDelay);

            if (logit) {
                console.log(
                    `level ${depth + 1} (${color}):`,
                    'roundSalience', branch.roundSalience
                );
            }
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


/** Outline stroked + filled at 25% as ONE path (per-piece fills only cover chords). */
function drawOutline(
        g: SVGGElement,
        pss: number[][][],
        color: string,
        showDelay?: number) {

    const [$path] = drawBeziersAsSinglePath(g, pss, `thin20 ${color} fill25`);
    if ($path !== undefined && showDelay) {
        setTimeout(() => $path.remove(), showDelay);
    }
}


export { drawFatBranchTree }
