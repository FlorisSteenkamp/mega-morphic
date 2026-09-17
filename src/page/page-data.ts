import type { Props } from './props.js';
import type { MorphEntry } from './draw-morph.js';
import type { FeatureMark } from '../morph/build-morph-entries/build-morph-entries.js';
import type { PoseRamp } from '../morph/pose-ramp.js';


interface PageData {
    readonly props: Props;
    readonly svgRef1: React.RefObject<SVGSVGElement | null>;
    readonly svgRef2: React.RefObject<SVGSVGElement | null>;
    readonly svgRef3: React.RefObject<SVGSVGElement | null>;
    readonly morphRef: React.RefObject<MorphEntry[] | null>,
    /** feature marks of the current morph (set together with morphRef) */
    readonly morphMarksRef: React.RefObject<FeatureMark[] | null>,
    /** pose ramp of the current morph (set together with morphRef) */
    readonly morphPoseRef: React.RefObject<PoseRamp | null>,
    readonly morphT: number;
}


export { PageData }
