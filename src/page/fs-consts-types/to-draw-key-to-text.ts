
/**
 * The drawable debug elements (checkbox labels, in display order) - the
 * single source of the `ToDraw` keys.
 */
const toDrawKeyToText = {
    oneProng: "1-prongs",
    twoProng: "2-prongs",
    threeProng: "3-prongs",
    vertex: 'Vertices',
    mat: "MAT",
    // sat: "SAT",
    leaves: "Leaves",
    cull: "Culls",
    branch: "branches",
    holeCloser: "Hole-closers",
} as const;


export { toDrawKeyToText }
