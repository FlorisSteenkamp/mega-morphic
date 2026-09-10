// import type { FatBranch } from '../fat-branch/fat-branch.js';
// import type { ResidualSample } from '../residual-sample.js';
// import { getBoundaryBeziersToNext, getMatCurveToNext } from 'flo-mat';
// import { evalDeCasteljau, getTAtLength, length } from 'flo-bezier3';
// import {
//     getSkeletonBeziers, getSkeletonEdgeCpPairs,
//     getSkeletonRadii
// } from '../fat-branch/get-fat-branch-tree.js';
// import { getUnitTangent } from '../get-unit-tangent.js';
// import { SideResidual } from '../side-residual.js';
// import { ResidualProfile } from '../residual-profile.js';


// /** The branch's residual samples keyed by global normalized position. */
// function getResidualProfile(
//         fatBranch: FatBranch,
//         subdivs = 4): ResidualProfile {

//     const samples = getResidualSamples(fatBranch, subdivs);
//     const lengths = getSkeletonBeziers(fatBranch)
//         .map(ps => length([0, 1], ps));
//     const total = lengths.reduce((s, l) => s + l, 0);

//     const cum: number[] = [0];
//     for (const l of lengths) { cum.push(cum[cum.length - 1] + l); }

//     const us: number[] = [];
//     const out: SideResidual[] = [];
//     const back: SideResidual[] = [];
//     for (const smp of samples) {
//         us.push(total === 0
//             ? 0
//             : (cum[smp.edge] + smp.f*lengths[smp.edge]) / total);
//         out.push(smp.out);
//         back.push(smp.back);
//     }

//     return { us, out, back };
// }


// /** The point at arc-length fraction `f` along a multi-bezier piece. */
// function sampleAtArcFraction(pss: number[][][], f: number): number[] {
//     const lengths = pss.map(ps => length([0, 1], ps));
//     const total = lengths.reduce((s, l) => s + l, 0);
//     if (total === 0) { return pss[0][0]; }

//     let s = f * total;
//     let i = 0;
//     while (i < pss.length - 1 && s > lengths[i]) { s -= lengths[i]; i++; }

//     const t = Math.max(0, Math.min(1, getTAtLength(pss[i], s)));
//     return evalDeCasteljau(pss[i], t);
// }


// /** The two envelope contact points of the disk at `p` (sides +N / −N). */
// function envelopeContacts(
//         p: number[], T: number[], r: number, dr: number
// ): { plus: number[]; minus: number[] } {

//     const N = [-T[1], T[0]];
//     const c = Math.sqrt(Math.max(0, 1 - dr*dr));
//     const ux = -dr*T[0];
//     const uy = -dr*T[1];

//     return {
//         plus:  [p[0] + r*(ux + c*N[0]), p[1] + r*(uy + c*N[1])],
//         minus: [p[0] + r*(ux - c*N[0]), p[1] + r*(uy - c*N[1])],
//     };
// }


// /**
//  * Samples the boundary residuals of a fat branch: at `subdivs` arc positions
//  * per skeleton edge (plus the final edge end), the offset of the TRUE
//  * boundary (sampled between the MAT's exact contact points on each side)
//  * from the disk-envelope contact, expressed in the skeleton's local frame.
//  */
// function getResidualSamples(
//         fatBranch: FatBranch,
//         subdivs = 4): ResidualSample[] {

//     const pairs = getSkeletonEdgeCpPairs(fatBranch);
//     const radii = getSkeletonRadii(fatBranch);
//     if (pairs.length === 0) { return []; }

//     const samples: ResidualSample[] = [];

//     for (let j = 0; j < pairs.length; j++) {
//         const { out, back } = pairs[j];
//         const matCurve = getMatCurveToNext(out);
//         const edgeLen = length([0, 1], matCurve);
//         const pssOut = getBoundaryBeziersToNext(out);
//         const pssBack = getBoundaryBeziersToNext(back);
//         const dr = edgeLen === 0
//             ? 0
//             : Math.max(-1, Math.min(1, (radii[j + 1] - radii[j]) / edgeLen));

//         // include the very last skeleton point on the final edge
//         const nF = j === pairs.length - 1 ? subdivs + 1 : subdivs;
//         for (let k = 0; k < nF; k++) {
//             const f = Math.min(1, k / subdivs);

//             const t = edgeLen === 0
//                 ? f
//                 : Math.max(0, Math.min(1, getTAtLength(matCurve, f*edgeLen)));
//             const p = evalDeCasteljau(matCurve, t);
//             const T = getUnitTangent(matCurve, t);
//             const r = radii[j]*(1 - f) + radii[j + 1]*f;

//             const contacts = envelopeContacts(p, T, r, dr);

//             // `back` walks the edge in reverse: its piece runs end → tip.
//             const truthOut = sampleAtArcFraction(pssOut, f);
//             const truthBack = sampleAtArcFraction(pssBack, 1 - f);

//             samples.push({
//                 edge: j,
//                 f,
//                 out: sideResidual(truthOut, contacts, T),
//                 back: sideResidual(truthBack, contacts, T),
//             });
//         }
//     }

//     return samples;
// }


// function sideResidual(
//         truth: number[],
//         contacts: { plus: number[]; minus: number[] },
//         T: number[]): SideResidual {

//     const dPlus = dist2(truth, contacts.plus);
//     const dMinus = dist2(truth, contacts.minus);
//     const sigma: 1 | -1 = dPlus <= dMinus ? 1 : -1;
//     const c = sigma === 1 ? contacts.plus : contacts.minus;

//     const N = [-T[1], T[0]];
//     const dx = truth[0] - c[0];
//     const dy = truth[1] - c[1];

//     return {
//         sigma,
//         rT: dx*T[0] + dy*T[1],
//         rN: sigma*(dx*N[0] + dy*N[1]),
//     };
// }


// function dist2(p: number[], q: number[]): number {
//     return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
// }


// export { getResidualProfile }
