import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { MatchedPath } from './matched-path.js';
import type { PathCostWeights } from './path-cost-weights.js';
import type { PathGeom } from './path-geom.js';


interface Context {
    // readonly w: PathCostWeights;
    readonly unit1: number;
    readonly unit2: number;
    readonly sal1: number;
    readonly sal2: number;
    readonly paths1: (br: FatBranch) => PathGeom[];
    readonly paths2: (br: FatBranch) => PathGeom[];
    readonly memo: Map<string, MatchedPath>;
}


export type { Context }