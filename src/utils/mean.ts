import { sum } from "./sum.js";


function mean(vs: number[]): number {
    return sum(vs) / vs.length;
}


export { mean }
