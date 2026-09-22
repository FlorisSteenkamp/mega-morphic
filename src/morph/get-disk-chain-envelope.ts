import { evalDeCasteljau } from 'flo-bezier3';


const MIN_LEN = 1e-6;


/**
 * The envelope (variable-radius offset outline) of the maximal disks along
 * a skeleton path, returned as a closed polyline loop (2-point beziers).
 *
 * The envelope contact points of a disk at arc position `s` lie at
 * `p(s) + r(s)·u` with `u·T = −r′(s)` (the tilt term matters for tapering
 * strokes), one on each side, and the path is capped with disk arcs at both
 * ends.
 *
 * Returns `undefined` for fully degenerate input (a point with no radius).
 *
 * @param beziers the skeleton path segments
 * @param radii the disk radius at each segment boundary (`beziers.length + 1`)
 * @param subdivs samples per skeleton segment
 * @param capSteps polyline steps for a full-turn cap arc (scaled by sweep)
 */
function getDiskChainEnvelope(
        beziers: number[][][],
        radii: number[],
        subdivs = 4,
        capSteps = 16): number[][][] | undefined {

    // Sample disk centers and radii along the path.
    const ps: number[][] = [];
    const rs: number[] = [];
    for (let i = 0; i < beziers.length; i++) {
        for (let j = 0; j < subdivs; j++) {
            const u = j / subdivs;
            ps.push(evalDeCasteljau(beziers[i], u));
            rs.push(radii[i]*(1 - u) + radii[i + 1]*u);
        }
    }
    ps.push(evalDeCasteljau(beziers[beziers.length - 1], 1));
    rs.push(radii[radii.length - 1]);

    // Drop near-coincident samples (keeping the larger radius).
    const P: number[][] = [ps[0]];
    const R: number[] = [rs[0]];
    for (let i = 1; i < ps.length; i++) {
        const q = P[P.length - 1];
        if (Math.hypot(ps[i][0] - q[0], ps[i][1] - q[1]) > MIN_LEN) {
            P.push(ps[i]);
            R.push(rs[i]);
        } else if (rs[i] > R[R.length - 1]) {
            R[R.length - 1] = rs[i];
        }
    }

    // Degenerate path: just the (largest) disk, or nothing at all.
    if (P.length < 2) {
        return R[0] > MIN_LEN ? circleLoop(P[0], R[0], capSteps) : undefined;
    }

    const n = P.length;

    // Cumulative (chordal) arc length.
    const s: number[] = [0];
    for (let i = 1; i < n; i++) {
        s.push(s[i - 1] + Math.hypot(
            P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]
        ));
    }

    // Unit tangents and radius derivatives (central differences).
    const T: number[][] = [];
    const dr: number[] = [];
    for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 1);
        const i1 = Math.min(n - 1, i + 1);
        const ds = s[i1] - s[i0];
        const tx = (P[i1][0] - P[i0][0]) / ds;
        const ty = (P[i1][1] - P[i0][1]) / ds;
        const h = Math.hypot(tx, ty);
        T.push(h > 0 ? [tx / h, ty / h] : [1, 0]);
        // |r′| > 1 means one disk swallows the next - no side contact there.
        dr.push(Math.max(-1, Math.min(1, (R[i1] - R[i0]) / ds)));
    }

    // Contact points on both sides: u = −r′·T ± √(1−r′²)·N.
    const left: number[][] = [];
    const right: number[][] = [];
    for (let i = 0; i < n; i++) {
        const N = [-T[i][1], T[i][0]];
        const c = Math.sqrt(Math.max(0, 1 - dr[i]*dr[i]));
        const ux = -dr[i]*T[i][0];
        const uy = -dr[i]*T[i][1];
        left.push([
            P[i][0] + R[i]*(ux + c*N[0]),
            P[i][1] + R[i]*(uy + c*N[1])
        ]);
        right.push([
            P[i][0] + R[i]*(ux - c*N[0]),
            P[i][1] + R[i]*(uy - c*N[1])
        ]);
    }

    // Cap arc sample directions (T,N basis angles), sweeping DECREASING angle
    // so the whole loop turns consistently.
    const capPts = (
            i: number, from: number, to: number): number[][] => {
        const N = [-T[i][1], T[i][0]];
        const sweep = from - to;
        const steps = Math.max(2, Math.ceil(capSteps * sweep / (2*Math.PI)));
        const out: number[][] = [];
        for (let k = 1; k < steps; k++) {
            const th = from - sweep * (k / steps);
            const dx = Math.cos(th)*T[i][0] + Math.sin(th)*N[0];
            const dy = Math.cos(th)*T[i][1] + Math.sin(th)*N[1];
            out.push([P[i][0] + R[i]*dx, P[i][1] + R[i]*dy]);
        }
        return out;
    };

    // Contact angle in the (T,N) basis: left = +α, right = −α.
    const alpha = (i: number) =>
        Math.atan2(Math.sqrt(Math.max(0, 1 - dr[i]*dr[i])), -dr[i]);

    const aEnd = alpha(n - 1);
    const aStart = alpha(0);

    const pts = [
        ...left,
        // end cap: left → right through +T
        ...capPts(n - 1, aEnd, -aEnd),
        ...right.toReversed(),
        // start cap: right → left through −T
        ...capPts(0, -aStart, aStart - 2*Math.PI),
    ];

    return toPolylineLoop(pts);
}


function circleLoop(c: number[], r: number, steps: number): number[][][] {
    const pts: number[][] = [];
    for (let k = 0; k < steps; k++) {
        const th = -2*Math.PI * (k / steps);
        pts.push([c[0] + r*Math.cos(th), c[1] + r*Math.sin(th)]);
    }
    return toPolylineLoop(pts)!;
}


/** Closed loop of 2-point beziers, skipping degenerate (short) edges. */
function toPolylineLoop(pts: number[][]): number[][][] | undefined {
    const kept: number[][] = [];
    for (const p of pts) {
        const q = kept[kept.length - 1];
        if (q === undefined ||
            Math.hypot(p[0] - q[0], p[1] - q[1]) > MIN_LEN) {
            kept.push(p);
        }
    }
    // Drop a duplicated closing point.
    if (kept.length > 1) {
        const p = kept[0];
        const q = kept[kept.length - 1];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= MIN_LEN) { kept.pop(); }
    }
    if (kept.length < 3) { return undefined; }

    const loop: number[][][] = [];
    for (let i = 0; i < kept.length; i++) {
        loop.push([kept[i], kept[(i + 1) % kept.length]]);
    }
    return loop;
}


export { getDiskChainEnvelope }
