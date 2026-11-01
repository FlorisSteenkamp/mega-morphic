
/**
 * The drawable debug elements (checkbox labels, in draw order) - the single
 * source of the `ToDraw` keys. The checkboxes shown are `shownToDrawKeys`.
 */
const toDrawKeyToText = {
    oneProng: "1-prongs",
    twoProng: "2-prongs",
    threeProng: "3-prongs",
    vertex: 'Vertices',
    mat: "MAT",
    matNoHoles: "MAT (no holes)",
    leaves: "Leaves",
    cull: "Culls",
    branch: "branches",
    holeCloser: "Hole-closers",
    // overlays of the last morph's match (`drawOverlay`), not of the MATs
    match: "Match",
    matchHoles: "Match holes",
    vertexNums: "Vertex #s",
} as const;


export { toDrawKeyToText }
