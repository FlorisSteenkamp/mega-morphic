type ClickFor = 
    | 'twoProng'
    | 'threeProng'
    | 'bezier'
    | 'loopSimplified'
    | 'loopset'
    | 'cp'
    | 'curvature'
    | 'curve'
    | 'matCurve'
    | 'salience'
    | 'fatBranch'
    | 'fatTree'
    | 'pathMatchResult'
    | 'profileAlign'
    | 'childDtw'
    /** nearest morphed boundary bezier on the MORPH svg (at current t) */
    | 'mBezier'
    // | 'speed'


export type { ClickFor }