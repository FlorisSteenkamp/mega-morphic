import type { Props } from './props.js';
import type { MorphEntry } from './draw-morph.js';


interface PageData {
    readonly props: Props;
    readonly svgRef1: React.RefObject<SVGSVGElement | null>;
    readonly svgRef2: React.RefObject<SVGSVGElement | null>;
    readonly svgRef3: React.RefObject<SVGSVGElement | null>;
    readonly morphRef: React.RefObject<MorphEntry[] | null>,
    readonly morphT: number;
}


export { PageData }
