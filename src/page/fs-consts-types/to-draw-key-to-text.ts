import { ToDraw } from "../../state/to-draw"


const toDrawKeyToText: { [P in keyof ToDraw]?: string } = {
    mat: "MAT",
    // sat: "SAT",
    oneProng: "1-prongs",
    twoProng: "2-prongs",
    threeProng: "3-prongs",
    leaves: "Leaves",
    cull: "Culls",
    vertex: 'Vertices',
    branch: "branches",
    holeCloser: "Hole-closers",
}


export { toDrawKeyToText }
