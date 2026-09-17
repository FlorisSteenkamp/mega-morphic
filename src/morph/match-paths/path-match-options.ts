import type { PathCostWeights } from './path-cost-weights.js';


interface PathMatchOptions {
    readonly weights?: Partial<PathCostWeights>;
}


export type { PathMatchOptions }