import type { ProductDtwResult_Candidate } from '../product-dtw.js';


/** a trunk candidate with its stage-1/2 ranking */
interface Ranked {
    c: ProductDtwResult_Candidate;
    rank: number;
    cheap: number;
}


export type { Ranked }
