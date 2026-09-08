import type { FatBranch } from "../../morph/fat-branch.js";
import { drawFs } from 'flo-draw';
import { drawBeziersAsSinglePath } from '../../draw/draw-beziers-as-single-path.js';
import { getChainMatCurves } from '../../morph/get-chain-mat-curves.js';


function drawFatBranch(
        g: SVGGElement,
        showDelay = 0,
        fatBranch: FatBranch,
        logit = false) {

    if (fatBranch === undefined) { return; }

    if (logit) { console.log(fatBranch); }

        const { cpChain, pss } = fatBranch;

        drawOutline(g, pss, 'red', showDelay);
        getChainMatCurves(cpChain).forEach(ps => {
            drawFs.bezier(g, ps, 'thin2 blue nofill', showDelay);
        });

        // Tree levels, each in its own color; log the edge metadata.
        const levelColors = [
            'green', 'orange', 'purple', 'cyan', 'deeppink', 'darkgreen', 'brown'
        ];
        let level = [fatBranch];
        for (let depth = 0; level.length > 0; depth++) {
            const color = levelColors[depth % levelColors.length];
            const edges = level.flatMap(branch => branch.children ?? []);

            for (const edge of edges) {
                const { branch, distanceFromLeaf, roundSalienceFromLeaf, angle } = edge;

                drawOutline(g, branch.pss, color, showDelay);
                getChainMatCurves(branch.cpChain).forEach(ps => {
                    drawFs.bezier(g, ps, 'thin2 blue nofill', showDelay);
                });

                if (logit) {
                    console.log(
                        `level ${depth + 1} (${color}):`,
                        'distanceFromLeaf', distanceFromLeaf,
                        'roundSalienceFromLeaf', roundSalienceFromLeaf,
                        'angle', angle,
                        'roundSalience', branch.roundSalience
                    );
                }
            }

            level = edges.map(edge => edge.branch);
        }
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


export { drawFatBranch }
