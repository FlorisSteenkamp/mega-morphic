declare var _debug_: Debug;
import type { Debug } from '../debug/debug.js';
import type { ToDrawKey } from '../state/to-draw.js';
import { toDrawKeys } from '../state/to-draw.js';
import type { ClickFor } from '../state/click-for.js';
import type { Props } from './props.js';
import type { PageData } from './page-data.js';
import type { MorphEntry } from '../morph/morph-entry.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { PageState } from '../state/page-state.js';
import type { Mat } from 'flo-mat';
import type { GlyphPreset } from '../state/glyph-preset.js';
import { btnStyleBlue, btnStyleBlueFlipped, toggleBtnStyle } from './btn-styles.js';
import { defaultPathWeights } from '../morph/match-paths/path-cost-weights.js';
import { useRef, useEffect, useState } from 'react';
import { Slider } from '../components/simple-slider.js';
import { SimpleSelect } from '../components/simple-select.js';
import { ButtonGroup } from '../components/simple-button-group.js';
import { Checkbox, CheckboxStyles } from '../components/simple-checkbox.js';
import { loadDeducedProps } from './load-deduced-props.js';
import { STAGGER_COARSE, STAGGER_FINE } from '../morph/staggered-sat.js';
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
import { PresetSelect } from './components/preset-select.js';
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


const getGlyphNames_ = await getGlyphNames();


/** cost-class color per weight group (mirrors PathCostWeights grouping) */
const weightGroupColors = {
    dtw: '#1976d2',       // profile alignment (shapeCost + tailCost)
    children: '#388e3c',  // pooled children (childCost)
    trunk: '#f57c00'      // trunk orientation (sway)
} as const;

/** slider range + cost-class group per path-matching weight */
const weightRanges: Record<
        keyof PathCostWeights,
        { max: number; step: number; group: keyof typeof weightGroupColors }
    > = {
    radius: { max: 3, step: 0.1, group: 'dtw' },
    turning: { max: 1, step: 0.025, group: 'dtw' },
    gapOpen: { max: 1, step: 0.025, group: 'dtw' },
    gapExtend: { max: 0.3, step: 0.01, group: 'dtw' },
    tail: { max: 2, step: 0.1, group: 'dtw' },
    del: { max: 10, step: 0.2, group: 'children' },
    delFloor: { max: 1, step: 0.02, group: 'children' },
    position: { max: 5, step: 0.1, group: 'children' },
    spacing: { max: 0.5, step: 0.0125, group: 'children' },
    angle: { max: 2, step: 0.125, group: 'children' },
    sway: { max: 4, step: 0.1, group: 'trunk' }
};
// console.log(getGlyphNames_);


function Page(props: Props) {
    // Props
    const { stateControl, pageState } = props;
    const { upd, transientState } = stateControl;
    const {
        toDraw, viewbox1, viewbox2, viewbox3, deduced, showSvgs, flipH, flipV,
        showWeights, glyph1Name, glyph2Name, glyphPresets, clickFor,
        simplify, viewMat, staggeredSat, morphFillOnly,
        showPose, satScale, showDelay, pathWeights,
        morphT,
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
    const [showNeedle, setShowNeedle] = useState(false);

    const refPageData = useRef<PageData>(null);
    refPageData.current = {
        props, svgRef1, svgRef2, svgRef3, morphRef,
    };

    useEffect(function() { lazyLoadDeduced(refPageData, false) }, []); // run only once


    /** Updates the page state, then reloads the shapes (and everything deduced). */
    function updAndReload(patch: Partial<PageState>, changeViewbox: boolean) {
        upd(pageState, patch);
        lazyLoadDeduced(refPageData, changeViewbox);
    }

    /** Updates the page state, then redraws the morph. */
    function updAndRedrawMorph(patch: Partial<PageState>) {
        upd(pageState, patch);
        drawMorph(refPageData, morphT / 100);
    }


    function toDrawChanged(key: ToDrawKey) {
        return (shouldDraw: boolean) => {
            upd(pageState.toDraw, { [key]: shouldDraw });
            redrawElements(refPageData.current!, mats1, mats2, viewbox1, viewbox2);
        }
    }


    function showDelayChanged(showDelay: number) {
        upd(pageState, { showDelay });
    }

    function satScaleChanged(satScale: number) {
        updAndReload({ satScale }, false);
    }

    function onClickForChanged(key: ClickFor | 'spacer' | undefined): void {
        if (key === 'spacer') { return; }
        upd(pageState, { clickFor: key });
    }


    function toggleSvg(i: number) {
        const showSvgs = [...pageState.showSvgs] as [boolean, boolean, boolean];
        showSvgs[i] = !showSvgs[i];
        upd(pageState, { showSvgs });
    }

    function morphChanged(t: number) {
        // setMorphT(t);
        upd(pageState, { morphT: t })
        drawMorph(refPageData, t / 100);
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
        return (value: number) => {
            upd(pageState, {
                pathWeights: {
                    ...pageState.pathWeights,
                    [key]: value
                }
            });
        };
    }

    /** Load the preset's glyph pair. */
    function onPresetSelected(
            preset: GlyphPreset) {

        const [glyph1Name, glyph2Name] = preset;
        updAndReload({ glyph1Name, glyph2Name }, true);
    }

    /** Save the given glyph pair as a new preset. */
    function onPresetAdded(
            preset: GlyphPreset) {

        upd(pageState, { glyphPresets: [...glyphPresets, preset] });
    }

    /** Delete the preset at the given index. */
    function onPresetDeleted(
            idx: number) {

        upd(pageState, { glyphPresets: glyphPresets.filter((_, i) => i !== idx) });
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
        updAndReload({ rot1: (pageState.rot1 + 10) % 360 }, false);
    }

    /** Toggle shape 1's horizontal mirror and rebuild everything (testing). */
    function onFlipHClicked() {
        updAndReload({ flipH: !flipH }, false);
    }

    /** Toggle shape 1's vertical mirror and rebuild everything (testing). */
    function onFlipVClicked() {
        updAndReload({ flipV: !flipV }, false);
    }

    return <>
        <div style={{ height: '100vh', boxSizing: 'border-box', padding: '10px', display: 'flex', flexDirection: 'column' }}>
            <div>
            {toDrawKeys.map(key =>
                <Checkbox
                    key={key}
                    checked={toDraw[key]}
                    styles={toDrawCheckboxStyles}
                    text={toDrawKeyToText[key]}
                    onChanged={toDrawChanged(key)}
                />
            )}
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
                    <PresetSelect
                        presets={glyphPresets}
                        glyph1Name={glyph1Name}
                        glyph2Name={glyph2Name}
                        onSelected={onPresetSelected}
                        onAdded={onPresetAdded}
                        onDeleted={onPresetDeleted}
                    />
                </div>
                <div>
                    <SimpleSelect
                        value={glyph1Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '187px' }}
                        onChanged={glyph1Name => updAndReload({ glyph1Name }, true)}
                    />
                </div>
                <div>
                    <SimpleSelect
                        value={glyph2Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '187px' }}
                        onChanged={glyph2Name => updAndReload({ glyph2Name }, true)}
                    />
                </div>
                <Checkbox checked={simplify} styles={toDrawCheckboxStyles} text="simplify" onChanged={simplify => updAndReload({ simplify }, false)} />
                <Checkbox checked={!viewMat} styles={toDrawCheckboxStyles} text="SAT enabled" onChanged={satEnabled => updAndReload({ viewMat: !satEnabled }, false)} />
                <Checkbox checked={staggeredSat} styles={toDrawCheckboxStyles} text={`staggered SAT (${STAGGER_COARSE} → ${STAGGER_FINE})`} onChanged={staggeredSat => updAndReload({ staggeredSat }, false)} />
                <Checkbox checked={morphFillOnly} styles={toDrawCheckboxStyles} text="fill only" onChanged={morphFillOnly => updAndRedrawMorph({ morphFillOnly })} />
                <Checkbox checked={pageState.showMorphBounds} styles={toDrawCheckboxStyles} text="bounds" onChanged={showMorphBounds => updAndRedrawMorph({ showMorphBounds })} />
                <Checkbox checked={showPose} styles={toDrawCheckboxStyles} text="pose" onChanged={showPose => updAndRedrawMorph({ showPose })} />
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', paddingBottom: '8px' }}>
                <div style={{ minWidth: '225px'}}>
                    <p id="slider" style={{ marginTop: 0, marginBottom: '0.35em' }}>
                        SAT Scale
                    </p>
                    <Slider
                        value={satScale}
                        aria-labelledby="slider"
                        min={1} max={10} step={0.05}
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
                        min={0} max={50_000} step={200}
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
                {/* <div style={{ display: 'flex', gap: '6px' }}>
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
                </div> */}
                <div style={{ minWidth: '225px'}}>
                    <p id="slider" style={{ marginTop: 0, marginBottom: '0.35em' }}>
                        Morph
                    </p>
                    <Slider
                        value={morphT}
                        aria-labelledby="slider"
                        min={0} max={100} step={2}
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
                                style={toggleBtnStyle(on, false)}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => upd(pageState, { showWeights: !showWeights })}
                        style={toggleBtnStyle(showWeights, false)}
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
                    style={toggleBtnStyle(false, true)}
                >
                    reset
                </button>
                <button
                    onClick={() => setShowNeedle(show => !show)}
                    style={toggleBtnStyle(showNeedle, true)}
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
                onMouseUp={mouseUp(stateControl, svgRef3, 3)}
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
                onMouseUp={mouseUp(stateControl, svgRef1, 1)}
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
                onMouseUp={mouseUp(stateControl, svgRef2, 2)}
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


async function lazyLoadDeduced(
        refPageData: React.RefObject<PageData | null>,
        changeViewbox: boolean) {

    //-------------
    // Gather data
    //-------------
    const pageData = refPageData.current!;
    const { props } = pageData;
    const { stateControl } = props;
    const { upd, upd$, state: { appState } } = stateControl;
    const { pageState } = appState;
    const { glyph1Name, glyph2Name } = pageState;

    //------------
    // Load paths
    //------------
    const pathStr1 = await loadPath(glyph1Name);
    const pathStr2 = await loadPath(glyph2Name);

    const {
        bezierLoops1, bezierLoops2, mats1, mats2, coarseMats1, coarseMats2,
        viewbox1, viewbox2, timingAll
    } = loadDeducedProps(stateControl, pathStr1, pathStr2);

    upd$(stateControl.state.appState.pageState.deduced, {
        bezierLoops1,
        // Regenerated from the (possibly rotated) loops so the drawn
        // outline always matches what the MAT consumed.
        pathStr1: bezierLoops1
            .map(loop => beziersToSvgPathStr(loop)).join(' '),
        mats1,
        bezierLoops2, pathStr2, mats2,
        coarseMats1, coarseMats2
    });

    if (typeof _debug_ !== 'undefined') { logSomeStuff(timingAll); }

    redrawElements(pageData, mats1, mats2, viewbox1, viewbox2);

    upd(stateControl.state.appState.pageState, changeViewbox
        ? { viewbox1, viewbox2, viewbox3: unionViewbox(viewbox1, viewbox2) }
        : {}
    );

    onMorphClicked(refPageData);
}


/**
 * Redraws the selected debug elements (`toDraw`) of both shapes.
 *
 * @param pageData
 * @param mats1 shape 1's MATs
 * @param mats2 shape 2's MATs
 * @param viewbox1 shape 1's viewbox (sets the elements' scale)
 * @param viewbox2 shape 2's viewbox
 */
function redrawElements(
        pageData: PageData,
        mats1: Mat[],
        mats2: Mat[],
        viewbox1: number[][],
        viewbox2: number[][]) {

    const { props, svgRef1, svgRef2 } = pageData;
    const { state: { appState }, transientState } = props.stateControl;
    const { $svgs, $svgs2 } = transientState;
    const { satScale, toDraw } = appState.pageState;

    drawElements(satScale, mats1, toDraw, svgRef1.current!, $svgs, viewbox1);
    drawElements(satScale, mats2, toDraw, svgRef2.current!, $svgs2, viewbox2);
}


export { Page }
