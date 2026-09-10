// qqq import { getBounds_ } from "../get-bounds-";
import { getBounds } from 'flo-bezier3';


function getLoopBounds(pss: number[][][]) {
    // qqq let bounds = pss.map(ps => getBounds_(ps))
    let bounds = pss.map(getBounds);
    return {
        minX: Math.min(...bounds.map(bound => bound.box[0][0])),
        maxX: Math.max(...bounds.map(bound => bound.box[1][0])),
        minY: Math.min(...bounds.map(bound => bound.box[0][1])),
        maxY: Math.max(...bounds.map(bound => bound.box[1][1])),
    };
}


function getViewBoxForShape(bezierLoops: number[][][][]) {
    let minX_ = Infinity;
    let minY_ = Infinity;
    let maxX_ = -Infinity;
    let maxY_ = -Infinity;
    for (let bezierLoop of bezierLoops) {
        let { minX, maxX, minY, maxY } = getLoopBounds(bezierLoop);
        if (minX < minX_) { minX_ = minX }
        if (minY < minY_) { minY_ = minY }
        if (maxX > maxX_) { maxX_ = maxX }
        if (maxY > maxY_) { maxY_ = maxY }
    }

    let width = maxX_ - minX_;
    let height = maxY_ - minY_;

    // The margin around the shape
    let _cx = Math.max(width, height) * 0.5;
    let cx_ = Math.max(width, height) * 0.5;
    let _cy = Math.max(width, height) * 0.05;
    let cy_ = Math.max(width, height) * 0.05;

    return [[minX_-_cx, minY_-_cy], [maxX_+cx_, maxY_+cx_]];
}


/** The smallest viewbox containing both given viewboxes. */
function unionViewbox(vb1: number[][], vb2: number[][]): number[][] {
    return [
        [Math.min(vb1[0][0], vb2[0][0]), Math.min(vb1[0][1], vb2[0][1])],
        [Math.max(vb1[1][0], vb2[1][0]), Math.max(vb1[1][1], vb2[1][1])],
    ];
}


function toViewBoxStr(viewbox: number[][]) {
    let [x,y] = viewbox[0];
    let w = viewbox[1][0] - x;
    let h = viewbox[1][1] - y;
    return '' + 
        x.toFixed(5) + ' ' + 
        y.toFixed(5) + ' ' + 
        w.toFixed(5) + ' ' + 
        h.toFixed(5);
}


export { 
    getViewBoxForShape,
    toViewBoxStr,
    unionViewbox
};
