import type { Props } from './props.js';
import type { MorphEntry } from '../morph/morph-entry.js';
import type { PoseRamp } from '../morph/procrustes/pose-ramp.js';


interface PageData {
    readonly props: Props;
    readonly svgRef1: React.RefObject<SVGSVGElement | null>;
    readonly svgRef2: React.RefObject<SVGSVGElement | null>;
    readonly svgRef3: React.RefObject<SVGSVGElement | null>;
    readonly morphRef: React.RefObject<MorphEntry[] | null>,
}


export { PageData }
