import type { BezierPiece } from 'flo-bezier3';
import { fromTo } from 'flo-bezier3';
import { drawFs } from 'flo-draw';


function drawBezierPieces(
        g: SVGGElement,
        bezierPieces: BezierPiece[],
        classes_ = 'red thin10 nofill, green thin10 nofill, deeppink thin10 nofill',
        delay = 0,
        scaleFactor = 1) {

    const $svgs: SVGElement[] = [];

    const classes = classes_.split(',');
    for (let i=0; i<bezierPieces.length; i++) {
        const piece = bezierPieces[i];
        const { ps, ts } = piece;
        if (ts[0] === ts[1]) {
            $svgs.push(...drawFs.crossHair(g, ps[0], classes[i%classes.length], scaleFactor, delay));
        }
        const bezier = fromTo(ps, ts[0], ts[1]);
        $svgs.push(...drawFs.bezier(g, bezier, classes[i%classes.length], delay));
    }

    return $svgs;
}


export { drawBezierPieces }
