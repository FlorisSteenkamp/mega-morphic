declare var _debug_: Debug;
import * as React from 'react';
import type { Debug } from '../debug/debug.js';
import type { ToDraw } from '../state/to-draw.js';
import type { ClickFor } from '../state/click-for.js';
import type { Props } from './props.js';
import type { PageData } from './page-data.js';
import type { MorphEntry } from '../morph/draw-morph/draw-morph.js';
import type { FeatureMark } from '../morph/build-morph-entries/build-morph-entries.js';
import type { PoseRamp } from '../morph/pose-ramp.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import { defaultPathWeights } from '../morph/match-paths/path-cost-weights.js';
import { useRef, useEffect } from 'react';
import { Slider } from '../components/simple-slider.js';
import { SimpleSelect } from '../components/simple-select.js';
import { ButtonGroup } from '../components/simple-button-group.js';
import { Checkbox, CheckboxStyles } from '../components/simple-checkbox.js';
import { loadDeducedProps } from './load-deduced-props.js';
import { logSomeStuff } from './log/log-some-stuff.js';
import { toViewBoxStr, unionViewbox, getFlipTransform } from './fs-consts-types/viewbox.js';
import { onClick } from './mouse/on-click.js';
import { toDrawKeyToText } from './fs-consts-types/to-draw-key-to-text.js';
import { mouseMove } from './mouse/mouse-move.js';
import { mouseDown } from './mouse/mouse-down.js';
import { mouseUp } from './mouse/mouse-up.js';
import { panMouseDown } from './mouse/pan.js';
import { drawElements } from './fs-consts-types/draw-elems.js';
import { getGlyphNames, loadPath } from './fs-consts-types/load-path.js';
import { drawMatch } from './events/draw-match.js';
import { showVertexNums } from './events/show-vertex-nums.js';
import { NeedleWindow } from './components/needle-window.js';
import { onMorphClicked } from './events/on-morph-clicked.js';
import { drawMorph } from '../morph/draw-morph/draw-morph.js';
import { beziersToSvgPathStr } from 'flo-boolean';


const toDrawCheckboxStyles: CheckboxStyles = { 
    div: {
        display: 'inline-block', 
        marginBottom: '5px', 
        fontWeight: 400,
        width: '120px'
    }
}


const showChangedStyles: CheckboxStyles = { 
    div: { 
        ...toDrawCheckboxStyles.div, 
    }
}


const btnStyleBlue: React.CSSProperties = {
    padding: '9px 20px',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '1',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#fff',               // unflipped
    backgroundColor: '#1976d2',  // ...
    border: 'none',                // ...
}


const btnStyleBlueFlipped: React.CSSProperties = {
    ...btnStyleBlue,
    color: '#1976d2',             // flipped
    backgroundColor: '#fff',      // ...
    border: '1px solid #1976d2',  // ...
}

const getGlyphNames_ = await getGlyphNames();


/** cost-class color per weight group (mirrors PathCostWeights grouping) */
const weightGroupColors = {
    dtw: '#1976d2',       // profile alignment (shapeCost + tailCost)
    children: '#388e3c',  // pooled children (childCost)
    trunk: '#f57c00'      // trunk orientation (sway)
} as const;

/** slider range + cost-class group per path-matching weight */
const weightRanges: Record<keyof PathCostWeights,
        { max: number; step: number;
          group: keyof typeof weightGroupColors }> = {
    radius: { max: 3, step: 0.05, group: 'dtw' },
    turning: { max: 1, step: 0.01, group: 'dtw' },
    gapOpen: { max: 1, step: 0.01, group: 'dtw' },
    gapExtend: { max: 0.3, step: 0.005, group: 'dtw' },
    tail: { max: 2, step: 0.05, group: 'dtw' },
    del: { max: 10, step: 0.1, group: 'children' },
    delFloor: { max: 1, step: 0.01, group: 'children' },
    position: { max: 2, step: 0.05, group: 'children' },
    angle: { max: 2, step: 0.05, group: 'children' },
    sway: { max: 4, step: 0.05, group: 'trunk' }
};
// console.log(getGlyphNames_);


function Page(props: Props) {
    // Props
    const { stateControl, pageState } = props;
    const { upd, transientState } = stateControl;
    const { $svgs, $svgs2 } = transientState;
    const {
        toDraw, viewbox1, viewbox2, viewbox3, deduced, showSvgs, flipH, flipV,
        showWeights, glyph1Name, glyph2Name, clickFor,
        simplify, viewMat, morphFillOnly, poseCentroid, poseScale,
        poseMoment, showPose, satScale, showDelay, pathWeights,
        morphT
    } = pageState;
    const { mats1, mats2, pathStr1, pathStr2 } = deduced;

    // Hooks
    const svgRef1 = useRef<SVGSVGElement>(null);
    const svgRef2 = useRef<SVGSVGElement>(null);
    const svgRef3 = useRef<SVGSVGElement>(null);
    const refX = useRef<HTMLSpanElement>(null);
    const refY = useRef<HTMLSpanElement>(null);

    // Drawables to interpolate on the morph slider (set by onMorph). Each entry
    // interpolates `a` → `b` at t; both are corresponded control-point-for-
    // control-point. Matched pairs go glyph1 → glyph2; a deleted branch retracts
    // into its attachment point (b is collapsed); an inserted branch grows out
    // of its attachment point (a is collapsed). Entries may be glued to a
    // parent entry so their junction stays attached throughout the morph.
    const morphRef = useRef<MorphEntry[] | null>(null);
    const morphMarksRef = useRef<FeatureMark[] | null>(null);
    const morphPoseRef = useRef<PoseRamp | null>(null);
    // const [morphT, setMorphT] = React.useState(0);  // slider value 0..100
    const [showNeedle, setShowNeedle] = React.useState(false);

    const refPageData = useRef<PageData>(null);
    const pageData: PageData = {
        props, svgRef1, svgRef2, svgRef3, morphRef, morphMarksRef,
        morphPoseRef//, morphT
    };
    refPageData.current = pageData;


    useEffect(function() { lazyLoadDeduced(false) }, []); // run only once

    function toDrawChanged(key: keyof ToDraw) {
        return (shouldDraw: boolean) => {
            upd(pageState.toDraw, { [key]: shouldDraw });
            drawElements(
                pageState.satScale,
                mats1,
                stateControl.state.appState.pageState.toDraw,
                svgRef1.current!, $svgs, viewbox1
            );
            drawElements(
                pageState.satScale,
                mats2,
                stateControl.state.appState.pageState.toDraw,
                svgRef2.current!, $svgs2, viewbox2
            );
        }
    }


    function onViewMatChanged(viewMat: boolean) {
        upd(pageState, { viewMat });
        lazyLoadDeduced(false);
    }

    function onSimplifyChanged(simplify: boolean) {
        upd(pageState, { simplify });
        lazyLoadDeduced(false);
    }

    function showDelayChanged(
            event: Event, value: number | number[], activeThumb: number) {

        upd(pageState, { showDelay: value as number });
    }

    function satScaleChanged(
            event: Event, value: number | number[], activeThumb: number) {
                
        let satScale = value as number;
        upd(pageState, { satScale });
        lazyLoadDeduced(false);
    }


    async function lazyLoadDeduced(
            changeViewbox: boolean) {

        const { pageState } = stateControl.state.appState;
        const { satScale, glyph1Name, glyph2Name } = pageState;

        const { pathStr: pathStr1 } = await loadPath(glyph1Name);
        const { pathStr: pathStr2 } = await loadPath(glyph2Name);

        const { bezierLoops1, bezierLoops2, mats1, mats2, viewbox1, viewbox2, timingAll } = 
            loadDeducedProps(stateControl, pathStr1, pathStr2);

        upd(stateControl.state.appState.pageState.deduced, {
            bezierLoops1,
            // Regenerated from the (possibly rotated) loops so the drawn
            // outline always matches what the MAT consumed.
            pathStr1: bezierLoops1
                .map(loop => beziersToSvgPathStr(loop)).join(' '),
            mats1,
            bezierLoops2, pathStr2, mats2,
        });

        if (typeof _debug_ !== 'undefined') { logSomeStuff(timingAll); }

        drawElements(
            satScale, mats1, toDraw, svgRef1.current!, $svgs, viewbox1
        );
        drawElements(
            satScale, mats2, toDraw, svgRef2.current!, $svgs2, viewbox2
        );

        upd(stateControl.state.appState.pageState, {
            ...(changeViewbox ? { viewbox1 } : {}),
            ...(changeViewbox ? { viewbox2 } : {}),
            ...(changeViewbox ? { viewbox3: unionViewbox(viewbox1, viewbox2) } : {}),
        });
    }


    function onClickForChanged(key: ClickFor | 'spacer' | undefined): void {
        if (key === 'spacer') { return; }
        upd(pageState, { clickFor: key });
    }


    function vector1Changed(vectorName: string) {
        upd(pageState, { glyph1Name: vectorName });
        lazyLoadDeduced(true);
    }

    function vector2Changed(vectorName: string) {
        upd(pageState, { glyph2Name: vectorName });
        lazyLoadDeduced(true);
    }

    function toggleSvg(i: number) {
        const showSvgs = [...pageState.showSvgs] as [boolean, boolean, boolean];
        showSvgs[i] = !showSvgs[i];
        upd(pageState, { showSvgs });
    }

    function morphChanged(
            event: Event, value: number | number[], activeThumb: number) {

        const t = value as number;
        // setMorphT(t);
        upd(pageState, { morphT: t })
        drawMorph(refPageData, t / 100);
    }

    function onMorphFillOnlyChanged(morphFillOnly: boolean) {
        upd(pageState, { morphFillOnly });
        drawMorph(refPageData, morphT / 100);
    }

    function onShowMorphBoundsChanged(showMorphBounds: boolean) {
        upd(pageState, { showMorphBounds });
        drawMorph(refPageData, morphT / 100);
    }

    function onPoseCentroidChanged(poseCentroid: boolean) {
        upd(pageState, { poseCentroid });
    }

    function onPoseScaleChanged(poseScale: boolean) {
        upd(pageState, { poseScale });
    }

    function onPoseMomentChanged(poseMoment: boolean) {
        upd(pageState, { poseMoment });
    }

    function onShowPoseChanged(showPose: boolean) {
        upd(pageState, { showPose });
        drawMorph(refPageData, morphT / 100);
    }

    function onShowMatchChanged(show: boolean) {
        upd(pageState, { showMatch: show });
        drawMatch(refPageData, show, pageState.showMatchBoundary);
    }

    function onShowMatchBoundaryChanged(show: boolean) {
        upd(pageState, { showMatchBoundary: show });
        drawMatch(refPageData, pageState.showMatch, show);
    }

    function onShowBranchNumsChanged(show: boolean) {
        upd(pageState, { showBranchNums: show });
        showVertexNums(refPageData, show);
    }

    function pathWeightChanged(key: keyof PathCostWeights) {
        return (event: Event, value: number | number[]) => {
            upd(pageState, {
                pathWeights: {
                    ...pageState.pathWeights,
                    [key]: value as number
                }
            });
        };
    }

    /** Zoom the morph svg out 2x around its current center. */
    function onZoomOutClicked() {
        const [[minX, minY], [maxX, maxY]] = pageState.viewbox3;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const hw = maxX - cx;
        const hh = maxY - cy;
        transientState.viewboxStack3.push(pageState.viewbox3);
        upd(pageState, {
            viewbox3: [[cx - 2*hw, cy - 2*hh], [cx + 2*hw, cy + 2*hh]]
        });
    }

    /** Rotate shape 1 a further 10° and rebuild everything (testing). */
    function onRotate10Clicked() {
        upd(pageState, { rot1: (pageState.rot1 + 10) % 360 });
        lazyLoadDeduced(false);
    }

    /** Toggle shape 1's horizontal mirror and rebuild everything (testing). */
    function onFlipHClicked() {
        upd(pageState, { flipH: !flipH });
        lazyLoadDeduced(false);
    }

    /** Toggle shape 1's vertical mirror and rebuild everything (testing). */
    function onFlipVClicked() {
        upd(pageState, { flipV: !flipV });
        lazyLoadDeduced(false);
    }

    return <>
        <div style={{ height: '100vh', boxSizing: 'border-box', padding: '10px', display: 'flex', flexDirection: 'column' }}>
            <div>
            {Object
            .keys(toDraw)
            .filter(key => !!toDrawKeyToText[key as keyof ToDraw])
            .map(_key => {
                let key = _key as keyof ToDraw;
                return (
                    <Checkbox 
                        key={key}
                        checked={toDraw[key]} 
                        styles={toDrawCheckboxStyles}
                        text={toDrawKeyToText[key] as string}
                        onChanged={toDrawChanged(key)} 
                    />
                );
            })}
            <Checkbox
                checked={pageState.showMatch}
                styles={toDrawCheckboxStyles}
                text="match"
                onChanged={onShowMatchChanged}
            />
            <Checkbox
                checked={pageState.showMatchBoundary}
                styles={toDrawCheckboxStyles}
                text="match bnds"
                onChanged={onShowMatchBoundaryChanged}
            />
            <Checkbox
                checked={pageState.showBranchNums}
                styles={toDrawCheckboxStyles}
                text="vertex #s"
                onChanged={onShowBranchNumsChanged}
            />
            </div>
            <ButtonGroup<ClickFor>
                options={{
                    twoProng: { text: '2-prong' },
                    threeProng: { text: '3-prong' },
                    bezier: { text: 'bezier' },
                    loopSimplified: { text: 'loop (simplified)' },
                    loopset: { text: 'loop set' },
                    cp: { text: 'cp' },
                    curvature: { text: 'k'},
                    curve: { text: 'curve' },
                    matCurve: { text: 'mat-curve'},
                    salience: { text: 'salience' },
                    fatBranch: { text: 'fat branch' },
                    fatTree: { text: 'fat tree' },
                    pathMatchResult: { text: 'path match' },
                    profileAlign: { text: 'align' },
                    childDtw: { text: 'child dtw' },
                    mBezier: { text: 'm-bezier' }
                }}
                value={clickFor}
                onChanged={onClickForChanged}
            />
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '10px', marginBottom: '2px' }}>
                <div>
                    <SimpleSelect
                        value={glyph1Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '150px' }}
                        onChanged={vector1Changed}
                    />
                </div>
                <div>
                    <SimpleSelect
                        value={glyph2Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '150px' }}
                        onChanged={vector2Changed}
                    />
                </div>
                <Checkbox checked={simplify} styles={showChangedStyles} text="simplify" onChanged={onSimplifyChanged} />
                <Checkbox checked={viewMat} styles={showChangedStyles} text="mat/sat" onChanged={onViewMatChanged} />
                <Checkbox checked={morphFillOnly} styles={showChangedStyles} text="fill only" onChanged={onMorphFillOnlyChanged} />
                <Checkbox checked={pageState.showMorphBounds} styles={showChangedStyles} text="bounds" onChanged={onShowMorphBoundsChanged} />
                <Checkbox checked={poseCentroid} styles={showChangedStyles} text="centroid" onChanged={onPoseCentroidChanged} />
                <Checkbox checked={poseScale} styles={showChangedStyles} text="scale" onChanged={onPoseScaleChanged} />
                <Checkbox checked={poseMoment} styles={showChangedStyles} text="2nd moment" onChanged={onPoseMomentChanged} />
                <Checkbox checked={showPose} styles={showChangedStyles} text="pose" onChanged={onShowPoseChanged} />
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', paddingBottom: '8px' }}>
                <div style={{ minWidth: '225px'}}>
                    <p id="slider" style={{ marginTop: 0, marginBottom: '0.35em' }}>
                        SAT Scale
                    </p>
                    <Slider
                        value={satScale}
                        aria-labelledby="slider"
                        min={1} max={10} step={0.025}
                        valueLabelDisplay="auto"
                        onChange={satScaleChanged}
                    />
                </div>
                <div style={{ minWidth: '225px'}}>
                    <p id="slider" style={{ marginTop: 0, marginBottom: '0.35em' }}>
                        Show delay
                    </p>
                    <Slider
                        value={showDelay}
                        aria-labelledby="slider"
                        min={0} max={50_000} step={100}
                        valueLabelDisplay="auto"
                        onChange={showDelayChanged}
                    />
                </div>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={onZoomOutClicked}
                        style={btnStyleBlue}
                    >
                        zoom out
                    </button>
                </div>
                <div style={{ display: 'flex', position: 'relative' }}>
                    <span style={{
                        position: 'absolute',
                        top: '-16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '12px',
                        color: '#1976d2',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                    }}>
                        {pageState.rot1}°
                    </span>
                    <button
                        onClick={onRotate10Clicked}
                        style={btnStyleBlue}
                    >
                        rotate 10
                    </button>
                </div>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={onFlipHClicked}
                        style={flipH ? btnStyleBlueFlipped : btnStyleBlue}
                    >
                        flip h
                    </button>
                </div>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={onFlipVClicked}
                        style={flipV ? btnStyleBlueFlipped : btnStyleBlue}
                    >
                        flip v
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        onClick={() => onMorphClicked(refPageData)}
                        style={{
                            padding: '9px 20px',
                            fontSize: '14px',
                            fontWeight: 500,
                            lineHeight: '1',
                            color: '#fff',
                            backgroundColor: '#1976d2',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        morph
                    </button>
                </div>
                <div style={{ minWidth: '225px'}}>
                    <p id="slider" style={{ marginTop: 0, marginBottom: '0.35em' }}>
                        Morph
                    </p>
                    <Slider
                        value={morphT}
                        aria-labelledby="slider"
                        min={0} max={100} step={1}
                        valueLabelDisplay="auto"
                        onChange={morphChanged}
                    />
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                    {[0, 1, 2].map(i => {
                        const on = showSvgs[i];
                        return (
                            <button
                                key={i}
                                onClick={() => toggleSvg(i)}
                                style={{
                                    padding: '9px 14px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    lineHeight: '1',
                                    color: on ? '#fff' : '#1976d2',
                                    backgroundColor: on ? '#1976d2' : '#fff',
                                    border: '1px solid #1976d2',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => upd(pageState, { showWeights: !showWeights })}
                        style={{
                            padding: '9px 14px',
                            fontSize: '14px',
                            fontWeight: 500,
                            lineHeight: '1',
                            color: showWeights ? '#fff' : '#1976d2',
                            backgroundColor: showWeights ? '#1976d2' : '#fff',
                            border: '1px solid #1976d2',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        weights
                    </button>
                </div>
            </div>
            {showWeights &&
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', paddingBottom: '6px' }}>
                {(Object.keys(weightRanges) as (keyof PathCostWeights)[])
                    .map(key => {
                        const color = weightGroupColors[weightRanges[key].group];
                        return (
                            <div key={key} style={{ minWidth: '110px' }}>
                                <p style={{ marginTop: 0, marginBottom: '0.1em', fontSize: '12px', color }}>
                                    {key}: {pathWeights[key]}
                                </p>
                                <Slider
                                    value={pathWeights[key]}
                                    min={0}
                                    max={weightRanges[key].max}
                                    step={weightRanges[key].step}
                                    color={color}
                                    onChange={pathWeightChanged(key)}
                                />
                            </div>
                        );
                    })}
                <button
                    onClick={() => upd(pageState, { pathWeights: defaultPathWeights })}
                    style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        lineHeight: '1',
                        color: '#1976d2',
                        backgroundColor: '#fff',
                        border: '1px solid #1976d2',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginBottom: '8px',
                    }}
                >
                    reset
                </button>
                <button
                    onClick={() => setShowNeedle(show => !show)}
                    style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        lineHeight: '1',
                        color: showNeedle ? '#fff' : '#1976d2',
                        backgroundColor: showNeedle ? '#1976d2' : '#fff',
                        border: '1px solid #1976d2',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginBottom: '8px',
                    }}
                >
                    needle
                </button>
            </div>}
            <span ref={refX} style={{ userSelect: 'none', position: 'fixed', bottom: '13px', left: '10px' }} />
            <span ref={refY} style={{ userSelect: 'none', position: 'fixed', bottom: '13px', left: '120px' }} />
            {showNeedle && <NeedleWindow onClose={() => setShowNeedle(false)} />}
            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
            <svg 
                id="svg3"
                ref={svgRef3}
                xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px"  y="0px"
                viewBox={toViewBoxStr(viewbox3)}
                style={{ width: '100%', height: '100%', minWidth: 0, border: '1px solid #ccc', display: showSvgs[2] ? undefined : 'none' }}
                onMouseDown={e => {
                    panMouseDown(stateControl, svgRef3)(e);
                    mouseDown(stateControl, svgRef3, viewbox3)(e);
                }}
                onMouseUp={mouseUp(stateControl, svgRef3, viewbox1, 3)}
                onMouseMove={mouseMove(stateControl, svgRef3, refX, refY, 3)}
                onClick={onClick(stateControl, svgRef3, 3, refPageData)}
            >
                <g transform={getFlipTransform(viewbox3)} />
            </svg>
            <svg 
                id="svg"
                ref={svgRef1}
                xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px"
                viewBox={toViewBoxStr(viewbox1)}
                style={{ width: '100%', height: '100%', minWidth: 0, border: '1px solid #ccc', display: showSvgs[0] ? undefined : 'none' }}
                onMouseDown={mouseDown(stateControl, svgRef1, viewbox1)}
                onMouseUp={mouseUp(stateControl, svgRef1, viewbox1, 1)}
                onMouseMove={mouseMove(stateControl, svgRef1, refX, refY, 1)}
                onClick={onClick(stateControl, svgRef1, 1)}
            >
                <g transform={getFlipTransform(viewbox1)}>
                    <path 
                        id="svg-path"
                        className="shape"
                        d={pathStr1}
                    />
                </g>
        </svg>
            <svg 
                id="svg2"
                ref={svgRef2}
                xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px"  y="0px"
                viewBox={toViewBoxStr(viewbox2)}
                style={{ width: '100%', height: '100%', minWidth: 0, border: '1px solid #ccc', display: showSvgs[1] ? undefined : 'none' }}
                onMouseDown={mouseDown(stateControl, svgRef2, viewbox2)}
                onMouseUp={mouseUp(stateControl, svgRef2, viewbox2, 2)}
                onMouseMove={mouseMove(stateControl, svgRef2, refX, refY, 2)}
                onClick={onClick(stateControl, svgRef2, 2)}
            >
                <g transform={getFlipTransform(viewbox2)}>
                    <path 
                        id="svg-path2"
                        className="shape"
                        d={pathStr2}
                    />
                </g>
            </svg>
            </div>
        </div>
    </>
}


export { Page }
