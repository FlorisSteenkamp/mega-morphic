declare var _debug_: Debug;
import type { Debug } from '../debug/debug.js';
import type { ToDrawKey } from '../state/to-draw.js';
import { toDrawKeys } from '../state/to-draw.js';
import type { ClickFor } from '../state/click-for.js';
import { defaultPageState } from '../state/default-state.js';
import type { Props } from './props.js';
import type { PageData } from './page-data.js';
import type { MorphEntry } from '../morph/morph-entry.js';
import type { PathCostWeights } from '../morph/match-paths/path-cost-weights.js';
import type { PageState } from '../state/page-state.js';
import type { Mat } from 'flo-mat';
import type { GlyphPreset } from '../state/glyph-preset.js';
import { defaultPathWeights } from '../morph/match-paths/path-cost-weights.js';
import { useRef, useEffect, useState } from 'react';
import { Slider } from '../components/simple-slider.js';
import { SimpleSelect } from '../components/simple-select.js';
import { ButtonGroup } from '../components/simple-button-group.js';
import { Checkbox } from '../components/simple-checkbox.js';
import { ToolGroup, DebugRow, getBtnClass } from '../components/tool-group.js';
import {
    PlayIcon, PauseIcon, RotateIcon, FlipHIcon, FlipVIcon, ZoomOutIcon,
    FitIcon, ArrowRightIcon, SlidersIcon
} from '../components/icons.js';
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
import { drawOverlay } from './events/draw-overlay.js';
import { NeedleWindow } from './components/needle-window.js';
import { DtwWindow } from './components/dtw-window.js';
import { PresetSelect } from './components/preset-select.js';
import { onMorphClicked } from './events/on-morph-clicked.js';
import { drawMorph } from '../morph/draw-morph/draw-morph.js';
import { beziersToSvgPathStr } from 'flo-boolean';


/** the view toggles, in the views' on-screen order: `showSvgs` index, label */
const VIEW_TOGGLES: readonly (readonly [number, string])[] = [
    [2, 'Morph'], [0, 'Vector 1'], [1, 'Vector 2']
];


const getGlyphNames_ = await getGlyphNames();


/** cost-class color per weight group (mirrors PathCostWeights grouping) */
const weightGroupColors = {
    dtw: '#1976d2',       // profile alignment (shapeCost)
    children: '#388e3c',  // pooled children (childCost)
    trunk: '#f57c00'      // trunk orientation (sway)
} as const;

/** slider range + cost-class group per path-matching weight */
const weightRanges: Record<
        keyof PathCostWeights,
        { max: number; step: number; group: keyof typeof weightGroupColors }
    > = {
    radius: { max: 3, step: 0.1, group: 'dtw' },
    turning: { max: 1, step: 0.05, group: 'dtw' },
    gapOpen: { max: 1, step: 0.05, group: 'dtw' },
    gapExtend: { max: 0.3, step: 0.01, group: 'dtw' },
    del: { max: 10, step: 0.2, group: 'children' },
    position: { max: 5, step: 0.1, group: 'children' },
    angle: { max: 2, step: 0.125, group: 'children' },
    childSway: { max: 10, step: 0.25, group: 'children' },
    sway: { max: 20, step: 0.5, group: 'trunk' }
};
// console.log(getGlyphNames_);

/** the morph's playback: one pass, glyph 1 → glyph 2, at speed 1 (seconds) */
const MORPH_PASS_SECONDS = 3;
/** the playback's hold at either glyph before turning back (seconds, at
 *  any speed) */
const MORPH_HOLD_SECONDS = 1;

/** a playing morph (`onPlayPauseClicked`) */
interface Playback {
    /** the pending animation frame's id */
    raf: number;
    /** the current t (0 to 100, as the slider) */
    t: number;
    /** playing towards glyph 2 (1) or back towards glyph 1 (-1) */
    dir: 1 | -1;
    /** the last frame's time (ms) */
    last: number;
    /** holding at a glyph until this time (ms; 0: not holding) */
    holdUntil: number;
}


function Page(props: Props) {
    // Props
    const { stateControl, pageState } = props;
    const { upd, transientState } = stateControl;
    const {
        toDraw, viewbox1, viewbox2, viewbox3, deduced, showSvgs,
        flipH, flipV1, flipV2,
        showDebug, glyph1Name, glyph2Name, glyphPresets, clickFor,
        simplify, viewMat, staggeredSat, morphFillOnly, morphPattern,
        showPose, satScale, showDelay, pathWeights,
        morphT, morphSpeed,
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
    const [showDtw, setShowDtw] = useState(false);

    // the morph's playback (`onPlayPauseClicked`) - and its t while
    // playing, for the slider (the page state is only set when it ends)
    const playRef = useRef<Playback | null>(null);
    const [playT, setPlayT] = useState<number | undefined>(undefined);

    const refPageData = useRef<PageData>(null);
    refPageData.current = {
        props, svgRef1, svgRef2, svgRef3, morphRef,
    };

    // run only once - fitting the viewboxes to the glyphs if they're still
    // the defaults' placeholders (a fresh state: a stored one is parsed, so
    // never the same object) - and resume the playback if it was left playing
    useEffect(function() {
        const isFresh = viewbox1 === defaultPageState.viewbox1;
        lazyLoadDeduced(refPageData, isFresh).then(() => {
            if (refPageData.current!.props.pageState.morphPlaying) {
                startPlayback();
            }
        });
    }, []);

    // no frames after the page is gone
    useEffect(function() {
        return () => {
            if (playRef.current !== null) {
                cancelAnimationFrame(playRef.current.raf);
            }
        };
    }, []);


    /**
     * Draws the next frame of the playback: t advanced by the time since the
     * last frame - on reaching either glyph, held there for
     * `MORPH_HOLD_SECONDS`, then turning back.
     *
     * * reads everything through refs, so the first render's copy serves
     *   every frame (the speed is the page state's latest)
     */
    function playStep(now: number) {
        const play = playRef.current;
        if (play === null) { return; }

        // holding at a glyph: nothing moves (and the hold's time is not
        // played on afterwards)
        if (now < play.holdUntil) {
            play.last = now;
            play.raf = requestAnimationFrame(playStep);
            return;
        }

        const { morphSpeed } = refPageData.current!.props.pageState;
        const dt = (now - play.last)/1000;
        play.last = now;

        let t = play.t + play.dir*100*morphSpeed*dt/MORPH_PASS_SECONDS;
        if (t >= 100 || t <= 0) {
            t = t >= 100 ? 100 : 0;
            play.dir = t === 100 ? -1 : 1;
            play.holdUntil = now + 1000*MORPH_HOLD_SECONDS;
        }
        play.t = t;

        drawMorph(refPageData, play.t / 100);
        setPlayT(play.t);
        play.raf = requestAnimationFrame(playStep);
    }


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
            if (key === 'match' || key === 'vertexNums') {
                drawOverlay(refPageData, key, shouldDraw);
                return;
            }
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

        // dragging the slider while playing moves the play position
        if (playRef.current !== null) { playRef.current.t = t; }
    }


    /**
     * Plays the morph from the current t - back and forth between the two
     * glyphs, at `morphSpeed`, each frame drawn directly (`playStep`) - or,
     * if playing, pauses it where it is (the page state only set then).
     */
    function onPlayPauseClicked() {
        const play = playRef.current;
        if (play !== null) {
            cancelAnimationFrame(play.raf);
            playRef.current = null;
            setPlayT(undefined);
            upd(pageState, { morphT: play.t, morphPlaying: false });
            drawMorph(refPageData, play.t / 100);

            return;
        }

        upd(pageState, { morphPlaying: true });
        startPlayback();
    }


    /** Starts the playback from the page state's t (see `playStep`). */
    function startPlayback() {
        const { morphT } = refPageData.current!.props.pageState;
        const next: Playback = {
            raf: 0, t: morphT, dir: morphT >= 100 ? -1 : 1,
            last: performance.now(), holdUntil: 0
        };
        playRef.current = next;
        next.raf = requestAnimationFrame(playStep);
    }

    function morphSpeedChanged(morphSpeed: number) {
        upd(pageState, { morphSpeed });
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

    /**
     * Resets all three viewboxes to their initial fit around the glyphs (by
     * reloading them), dropping the zoom history.
     */
    function onResetViewClicked() {
        transientState.viewboxStack1 = [];
        transientState.viewboxStack2 = [];
        transientState.viewboxStack3 = [];
        lazyLoadDeduced(refPageData, true);
    }

    /** Rotate shape 1 a further 15° and rebuild everything (testing). */
    function onRotate15Clicked() {
        updAndReload({ rot1: (pageState.rot1 + 15) % 360 }, false);
    }

    /** Toggle shape 1's horizontal mirror and rebuild everything (testing). */
    function onFlipHClicked() {
        updAndReload({ flipH: !flipH }, false);
    }

    /** Toggle shape 1's vertical mirror and rebuild everything. */
    function onFlipV1Clicked() {
        updAndReload({ flipV1: !flipV1 }, false);
    }

    /** Toggle shape 2's vertical mirror and rebuild everything. */
    function onFlipV2Clicked() {
        updAndReload({ flipV2: !flipV2 }, false);
    }

    const t = playT ?? morphT;
    const isPlaying = playT !== undefined;

    return <>
        <div style={{ height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <header className="ui-toolbar">
                <ToolGroup label="Vectors">
                    <PresetSelect
                        presets={glyphPresets}
                        glyph1Name={glyph1Name}
                        glyph2Name={glyph2Name}
                        onSelected={onPresetSelected}
                        onAdded={onPresetAdded}
                        onDeleted={onPresetDeleted}
                    />
                    <SimpleSelect
                        value={glyph1Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '140px' }}
                        onChanged={glyph1Name => updAndReload({ glyph1Name }, true)}
                    />
                    <span className="ui-arrow"><ArrowRightIcon /></span>
                    <SimpleSelect
                        value={glyph2Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '140px' }}
                        onChanged={glyph2Name => updAndReload({ glyph2Name }, true)}
                    />
                </ToolGroup>
                <ToolGroup label="Transform">
                    <button className="ui-btn" title="Rotate vector 1 a further 15°" onClick={onRotate15Clicked}>
                        <RotateIcon />{pageState.rot1}°
                    </button>
                    <div className="ui-seg">
                        <button className={getBtnClass(flipH, '')} title="Mirror vector 1 horizontally" onClick={onFlipHClicked}>
                            <FlipHIcon />H
                        </button>
                        <button className={getBtnClass(flipV1, '')} title="Mirror vector 1 vertically" onClick={onFlipV1Clicked}>
                            <FlipVIcon />V1
                        </button>
                        <button className={getBtnClass(flipV2, '')} title="Mirror vector 2 vertically" onClick={onFlipV2Clicked}>
                            <FlipVIcon />V2
                        </button>
                    </div>
                </ToolGroup>
                <ToolGroup label="Morph">
                    <button className="ui-btn ui-play" title={isPlaying ? 'Pause' : 'Play'} onClick={onPlayPauseClicked}>
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <div className="ui-slider-field" style={{ width: '160px' }}>
                        <Slider
                            value={t}
                            min={0} max={100} step={1}
                            onChange={morphChanged}
                        />
                        <span className="ui-value">{(t / 100).toFixed(2)}</span>
                    </div>
                    <span className="ui-inline-label">Speed</span>
                    <div className="ui-slider-field" style={{ width: '110px' }}>
                        <Slider
                            value={morphSpeed}
                            min={0.1} max={4} step={0.1}
                            onChange={morphSpeedChanged}
                        />
                        <span className="ui-value">{morphSpeed.toFixed(1)}×</span>
                    </div>
                </ToolGroup>
                <ToolGroup label="Display">
                    <div className="ui-seg">
                        <button className={getBtnClass(morphFillOnly, '')} onClick={() => updAndRedrawMorph({ morphFillOnly: !morphFillOnly })}>
                            Fill only
                        </button>
                        <button className={getBtnClass(morphPattern, '')} onClick={() => updAndRedrawMorph({ morphPattern: !morphPattern })}>
                            Pattern
                        </button>
                    </div>
                    <div className="ui-seg">
                        {VIEW_TOGGLES.map(([i, label]) =>
                            <button key={i} className={getBtnClass(showSvgs[i], '')} onClick={() => toggleSvg(i)}>
                                {label}
                            </button>
                        )}
                    </div>
                    <button className="ui-btn ui-icon" title="Reset the view to fit the glyphs" onClick={onResetViewClicked}>
                        <FitIcon />
                    </button>
                </ToolGroup>
                <div className="ui-spacer" />
                <button
                    className={getBtnClass(showDebug, '')}
                    title="Show the debug controls"
                    onClick={() => upd(pageState, { showDebug: !showDebug })}
                >
                    <SlidersIcon />Debug
                </button>
            </header>
            {showDebug &&
            <section className="ui-debug">
                <DebugRow label="Draw">
                    {toDrawKeys.map(key =>
                        <Checkbox
                            key={key}
                            checked={toDraw[key]}
                            text={toDrawKeyToText[key]}
                            onChanged={toDrawChanged(key)}
                        />
                    )}
                </DebugRow>
                <DebugRow label="Click">
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
                </DebugRow>
                <DebugRow label="Options">
                    <Checkbox checked={simplify} text="simplify" onChanged={simplify => updAndReload({ simplify }, false)} />
                    <Checkbox checked={!viewMat} text="SAT enabled" onChanged={satEnabled => updAndReload({ viewMat: !satEnabled }, false)} />
                    <Checkbox checked={staggeredSat} text={`staggered SAT (${STAGGER_COARSE} → ${STAGGER_FINE})`} onChanged={staggeredSat => updAndReload({ staggeredSat }, false)} />
                    <Checkbox checked={showPose} text="pose" onChanged={showPose => updAndRedrawMorph({ showPose })} />
                    <div className="ui-field" style={{ width: '200px' }}>
                        <span className="ui-field-label">SAT scale · {satScale}</span>
                        <Slider
                            value={satScale}
                            min={1} max={10} step={0.1}
                            onChange={satScaleChanged}
                        />
                    </div>
                    <div className="ui-field" style={{ width: '200px' }}>
                        <span className="ui-field-label">Show delay · {showDelay} ms</span>
                        <Slider
                            value={showDelay}
                            min={0} max={50_000} step={200}
                            onChange={showDelayChanged}
                        />
                    </div>
                </DebugRow>
                <DebugRow label="Weights">
                    {(Object.keys(weightRanges) as (keyof PathCostWeights)[])
                        .map(key => {
                            const color = weightGroupColors[weightRanges[key].group];
                            return (
                                <div key={key} className="ui-field" style={{ width: '120px' }}>
                                    <span className="ui-field-label" style={{ color }}>
                                        {key} · {pathWeights[key]}
                                    </span>
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
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            className="ui-btn ui-small"
                            onClick={() => upd(pageState, { pathWeights: defaultPathWeights })}
                        >
                            Reset
                        </button>
                        <button
                            className={getBtnClass(showNeedle, 'ui-small')}
                            onClick={() => { setShowNeedle(show => !show); setShowDtw(false); }}
                        >
                            Needle
                        </button>
                        <button
                            className={getBtnClass(showDtw, 'ui-small')}
                            onClick={() => { setShowDtw(show => !show); setShowNeedle(false); }}
                        >
                            DTW
                        </button>
                        <button className="ui-btn ui-small" title="Zoom the morph out 2×" onClick={onZoomOutClicked}>
                            <ZoomOutIcon />
                        </button>
                    </div>
                </DebugRow>
            </section>}
            <span ref={refX} className="ui-readout" style={{ left: '16px' }} />
            <span ref={refY} className="ui-readout" style={{ left: '110px' }} />
            {showNeedle && <NeedleWindow onClose={() => setShowNeedle(false)} />}
            {showDtw && <DtwWindow onClose={() => setShowDtw(false)} />}
            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, padding: '12px 16px 28px' }}>
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
        // Regenerated from the (possibly rotated / flipped) loops so the
        // drawn outlines always match what the MATs consumed.
        pathStr1: bezierLoops1
            .map(loop => beziersToSvgPathStr(loop)).join(' '),
        mats1,
        bezierLoops2,
        pathStr2: bezierLoops2
            .map(loop => beziersToSvgPathStr(loop)).join(' '),
        mats2,
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
