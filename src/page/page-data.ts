import type { Props } from './props.js';


interface PageData {
    readonly props: Props;
    readonly svgRef1: React.RefObject<SVGSVGElement | null>;
    readonly svgRef2: React.RefObject<SVGSVGElement | null>;
    readonly svgRef3: React.RefObject<SVGSVGElement | null>;
    readonly morphRef: React.RefObject<{
        a: number[][][];
        b: number[][][];
        classes: string;
    }[] | null>,
    readonly morphT: number;
}


export { PageData }
