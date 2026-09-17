
const { PI: π } = Math;


function wrapAngle(x: number): number {
    return ((x + π)%(2*π) + 2*π)%(2*π) - π;
}


export { wrapAngle }
