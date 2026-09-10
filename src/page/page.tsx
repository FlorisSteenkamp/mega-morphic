declare var _debug_: Debug;
import * as React from 'react';
import type { Debug } from '../debug.js';
import type { ToDraw } from '../state/to-draw.js';
import type { ClickFor } from '../state/page-state.js';
import type { Props } from './props.js';
import type { PageData } from './page-data.js';
import type { MorphEntry } from './draw-morph.js';
import { useRef, useEffect } from 'react';
import { Slider } from '../components/simple/simple-slider.js';
import { SimpleSelect } from '../components/simple/simple-select.js';
import { ButtonGroup } from '../components/simple/simple-button-group.js';
import { Checkbox } from '../components/simple/simple-checkbox.js';
import { loadDeducedProps } from './load-deduced-props.js';
import { logSomeStuff } from './log/log-some-stuff.js';
import { toViewBoxStr, unionViewbox } from './fs-consts-types/viewbox.js';
import { onClick } from './mouse/on-click.js';
import { toDrawKeyToText } from './fs-consts-types/to-draw-key-to-text.js';
import { mouseMove } from './mouse/mouse-move.js';
import { mouseDown } from './mouse/mouse-down.js';
import { mouseUp } from './mouse/mouse-up.js';
import { drawElements } from './fs-consts-types/draw-elems.js';
import { getGlyphNames, loadPath } from './fs-consts-types/load-path.js';
import { onMatchClicked } from './events/on-match-clicked.js';
import { onMorphClicked } from './events/on-morph-clicked.js';
import { onFattestClicked } from './events/on-fattest-clicked.js';
import { drawMorph } from './draw-morph.js';


const toDrawCheckboxStyles = { 
    div: {
        display: 'inline-block', 
        marginBottom: '5px', 
        fontWeight: 400,
        width: '200px'
    }
}


const showThreeProngChangedStyles = { 
    ...toDrawCheckboxStyles, 
    div: { 
        ...toDrawCheckboxStyles.div, 
        width: '150px' 
    }
}


const getGlyphNames_ = await getGlyphNames();
// console.log(getGlyphNames_);


function Page(props: Props) {
    // Props
    const { stateControl, pageState } = props;
    const { upd, transientState } = stateControl;
    const { $svgs, $svgs2 } = transientState;
    const { toDraw, viewbox1, viewbox2, viewbox3, deduced } = pageState;
    const { mats1, mats2 } = deduced;

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
    const [morphT, setMorphT] = React.useState(0);  // slider value 0..100

    const refPageData = useRef<PageData>(null);
    const pageData: PageData = {
        props, svgRef1, svgRef2, svgRef3, morphRef, morphT
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
            bezierLoops1, pathStr1, mats1,
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


    function onClickForChanged(key: ClickFor | 'spacer'): void {
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
        setMorphT(t);
        drawMorph(refPageData, t / 100);
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
                    branch: { text: 'branch' },
                    curve: { text: 'curve' },
                    matCurve: { text: 'mat-curve'},
                    salience: { text: 'salience' },
                    roundSalience: { text: 'round salience' }
                }}
                value={pageState.clickFor}
                onChanged={onClickForChanged}
            />
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '10px', marginBottom: '2px' }}>
                <div>
                    <SimpleSelect
                        value={pageState.glyph1Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '200px' }}
                        onChanged={vector1Changed}
                    />
                </div>
                <div>
                    <SimpleSelect
                        value={pageState.glyph2Name}
                        options={getGlyphNames_}
                        style={{ minWidth: '200px' }}
                        onChanged={vector2Changed}
                    />
                </div>
                <Checkbox checked={pageState.simplify} styles={showThreeProngChangedStyles} text="simplify" onChanged={onSimplifyChanged} />
                <Checkbox checked={pageState.viewMat} styles={showThreeProngChangedStyles} text="mat/sat" onChanged={onViewMatChanged} />
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', paddingBottom: '8px' }}>
                <div style={{ minWidth: '225px'}}>
                    <p id="slider" style={{ marginTop: 0, marginBottom: '0.35em' }}>
                        SAT Scale
                    </p>
                    <Slider
                        value={pageState.satScale}
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
                        value={pageState.showDelay}
                        aria-labelledby="slider"
                        min={0} max={50_000} step={100}
                        valueLabelDisplay="auto"
                        onChange={showDelayChanged}
                    />
                </div>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={() => onFattestClicked(refPageData)}
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
                        fattest
                    </button>
                </div>
                <div style={{ display: 'flex' }}>
                    <button
                        // onClick={() => onResidualClicked(refPageData)}
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
                        residual
                    </button>
                </div>
                <div style={{ display: 'flex' }}>
                    <button
                        onClick={() => onMatchClicked(refPageData)}
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
                        match
                    </button>
                </div>
                <div style={{ display: 'flex' }}>
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
                        const on = pageState.showSvgs[i];
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
                </div>
            </div>
            <span ref={refX} style={{ userSelect: 'none', position: 'fixed', bottom: '13px', left: '10px' }} />
            <span ref={refY} style={{ userSelect: 'none', position: 'fixed', bottom: '13px', left: '120px' }} />
            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
            <svg 
                id="svg3"
                ref={svgRef3}
                xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px"  y="0px"
                viewBox={toViewBoxStr(viewbox3)}
                style={{ width: '100%', height: '100%', minWidth: 0, border: '1px solid #ccc', display: pageState.showSvgs[2] ? undefined : 'none' }}
                onMouseDown={mouseDown(stateControl, svgRef3, viewbox3)}
                onMouseUp={mouseUp(stateControl, svgRef3, viewbox3, 3)}
                onMouseMove={mouseMove(stateControl, svgRef3, refX, refY, 3)}
                onClick={onClick(stateControl, svgRef3, 3)}
            >
                <g />
            </svg>
            <svg 
                id="svg"
                ref={svgRef1}
                xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px"
                viewBox={toViewBoxStr(viewbox1)}
                style={{ width: '100%', height: '100%', minWidth: 0, border: '1px solid #ccc', display: pageState.showSvgs[0] ? undefined : 'none' }}
                onMouseDown={mouseDown(stateControl, svgRef1, viewbox1)}
                onMouseUp={mouseUp(stateControl, svgRef1, viewbox1, 1)}
                onMouseMove={mouseMove(stateControl, svgRef1, refX, refY, 1)}
                onClick={onClick(stateControl, svgRef1, 1)}
            >
                <path 
                    id="svg-path"
                    className="shape"
                    d={pageState.deduced.pathStr1}
                />
                <g />
        </svg>
            <svg 
                id="svg2"
                ref={svgRef2}
                xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px"  y="0px"
                viewBox={toViewBoxStr(viewbox2)}
                style={{ width: '100%', height: '100%', minWidth: 0, border: '1px solid #ccc', display: pageState.showSvgs[1] ? undefined : 'none' }}
                onMouseDown={mouseDown(stateControl, svgRef2, viewbox2)}
                onMouseUp={mouseUp(stateControl, svgRef2, viewbox2, 2)}
                onMouseMove={mouseMove(stateControl, svgRef2, refX, refY, 2)}
                onClick={onClick(stateControl, svgRef2, 2)}
            >
                <path 
                    id="svg-path2"
                    className="shape"
                    d={pageState.deduced.pathStr2}
                />
                <g />
            </svg>
            </div>
        </div>
    </>
}


export { Page }
