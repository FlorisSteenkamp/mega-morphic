import type { FatBranch } from '../fat-branch/fat-branch.js';
import type { PathGeom } from './path-geom.js';


interface Context {
    /** tree 1 total round salience, used to normalize deletion costs */
    readonly sal1: number;
    /** tree 2 total round salience, used to normalize insertion costs */
    readonly sal2: number;
    /** memoized path enumeration for branches in tree 1 */
    readonly paths1: (br: FatBranch) => PathGeom[];
    /** memoized path enumeration for branches in tree 2 */
    readonly paths2: (br: FatBranch) => PathGeom[];
}


export type { Context }