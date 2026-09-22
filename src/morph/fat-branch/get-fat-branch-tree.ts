import type { CpNode } from "flo-mat";
import type { FatBranch } from "./fat-branch.js";
import { getMatCurveToNext, getRealProngCount, isOnSameCircle } from "flo-mat";
import { getShapeArea } from "flo-boolean";
import { getFatBranch } from "./get-fat-branch.js";
import { getFatBranchesFrom } from "./get-fat-branches-from.js";
import { getChainPss } from "./get-chain-pss.js";
import { totalLength$ } from "../fs/total-length.js";
import { getEdgeKey } from './get-edge-key.js';
import { rotateAtTip } from './rotate-at-tip.js';
import { getSkeletonLengthDepths } from "./get-skeleton-length-depths.js";
import { getSkeletonEdgeCps } from './get-skeleton-cps.js';
import { closeChain } from './close-chain.js';


/**
 * Returns the fat branch through the given `CpNode` as the trunk of a fully
 * recursive tree - each node's `children` edges store the child branch, its
 * skeleton distance and partial round salience from the parent's leaf tip,
 * and its signed emanating angle relative to the parent.
 */
function getFatBranchTree(
        cpNode: CpNode): FatBranch | undefined {

    // `getFatBranch` requires a plain 2-prong; walk to the nearest one.
    const cpStart = cpNode;
    while (getRealProngCount(cpNode) !== 2) {
        cpNode = cpNode.next;
        if (cpNode === cpStart) { return undefined; }
    }

    const fatTrunk = getFatBranch(cpNode);
    if (fatTrunk === undefined) { return undefined; }

    addChildren(fatTrunk);

    return fatTrunk;
}


/**
 * Adds child `FatBranch`es to the given parent `FatBranch`.
 * 
 * @param parent 
 */
function addChildren(
        parent: FatBranch): void {

    const branches = getFatBranchesFrom(parent);
    if (branches.length === 0) { return; }

    // Rotate the (closed) chain to start at the leaf tip so each node's
    // skeleton depth is its distance from the tip.
    const rotated = rotateAtTip(closeChain(parent.cpChain));
    const depths = getSkeletonLengthDepths(rotated);

    for (const branch of branches) {
        const s = branch.cpChain[0];  // contact on the fork circle

        // First/last encounters of the fork circle enclose the tip piece.
        let kF = -1;
        let mF = -1;
        for (let i = 0; i < rotated.length; i++) {
            if (isOnSameCircle(rotated[i], s)) {
                if (kF < 0) { kF = i; }
                mF = i;
            }
        }
        if (kF < 0 || mF === kF) { continue; }

        const distanceFromLeaf = depths[kF];

        // Tip piece: both boundary sides from the fork around the tip
        // (the rotation seam at the tip is an original chain transition),
        // closed across the fork disk by the distal arc so the disk's area
        // is counted exactly once (children cap at the circle, excluding it).
        const forkTipForkChain = [
            ...rotated.slice(mF),  // final `CpNode` of fork to tip
            ...rotated.slice(1, kF + 1),  // tip to first `CpNode` on fork
            rotated[mF]  // close the chain
        ];
        const roundSalienceFromLeaf = Math.abs(
            getShapeArea(getChainPss(forkTipForkChain, false))
        );

        // Parent travel direction (tip -> fork -> beyond) at the fork center
        // vs the child's emanating MAT direction from that same center.
        // The parent direction is the MEAN of its incoming end tangent and
        // its first outgoing start tangent around the fork circle - the
        // incoming tangent alone can pick the wrong angular side when the
        // parent bends sharply through the junction.
        const inDir = dirAtEnd(getMatCurveToNext(rotated[kF - 1]));
        const outDir = dirAtStart(getMatCurveToNext(rotated[kF]));
        const parentDir = meanDir(inDir, outDir);
        const childDir = dirAtStart(getMatCurveToNext(s));
        const angle = Math.atan2(
            parentDir[0]*childDir[1] - parentDir[1]*childDir[0],
            parentDir[0]*childDir[0] + parentDir[1]*childDir[1]
        );

        parent.children.push({
            branch,
            distanceFromLeaf,
            roundSalienceFromLeaf,
            angle,
            side: childSide(rotated, kF, s)
        });

        addChildren(branch);
    }
}


/**
 * The side of the parent's MAT a child emanates from: +1 if its sector is
 * skipped (jumped over) within the parent chain's FIRST run over the fork
 * circle (the outbound sleeve), -1 if within the return run.
 */
function childSide(rotated: CpNode[], kF: number, s: CpNode): 1 | -1 {
    for (let q = kF;
            q < rotated.length - 1 && isOnSameCircle(rotated[q], s);
            q++) {
        const next = rotated[q + 1];
        if (next === rotated[q].next || !isOnSameCircle(rotated[q], next)) {
            continue;  // boundary step or pass-through, not a jump
        }
        for (let c = rotated[q]; c !== next; c = c.nextOnCircle) {
            if (c === s) { return 1; }
        }
    }

    return -1;
}


/**
 * The fat branch's linear skeleton path as mat-curve beziers, ordered from
 * its leaf tip to its other end (each skeleton edge exactly once).
 */
function getSkeletonBeziers(fatBranch: FatBranch): number[][][] {
    return getSkeletonEdgeCps(fatBranch).map(cp => getMatCurveToNext(cp));
}


/** Total skeleton length of a fat branch chain (each edge counted once). */
function getSkeletonLength(cpChain: CpNode[]): number {
    const seen = new Set<string>();
    let total = 0;

    for (let i = 0; i < cpChain.length - 1; i++) {
        const cp = cpChain[i];

        if (cpChain[i+1] === cp.next) {
            const key = getEdgeKey(cp, cp.next);
            if (!seen.has(key)) {
                seen.add(key);
                total += totalLength$(getMatCurveToNext(cp));
            }
        }
    }

    return total;
}


function dirAtStart(
        ps: number[][]): number[] {

    const p0 = ps[0];
    for (let i = 1; i < ps.length; i++) {
        const [x, y] = [ps[i][0] - p0[0], ps[i][1] - p0[1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];
}


function dirAtEnd(ps: number[][]): number[] {
    const pE = ps[ps.length - 1];
    for (let i = ps.length - 2; i >= 0; i--) {
        const [x, y] = [pE[0] - ps[i][0], pE[1] - ps[i][1]];
        if (x !== 0 || y !== 0) { return [x, y]; }
    }
    return [0, 0];
}


/** Normalized mean of two directions; falls back to the non-degenerate
 *  one, and to `d1` when they are (near) anti-parallel. */
function meanDir(d1: number[], d2: number[]): number[] {
    const l1 = Math.hypot(d1[0], d1[1]);
    const l2 = Math.hypot(d2[0], d2[1]);
    if (l1 === 0) { return d2; }
    if (l2 === 0) { return d1; }

    const mx = d1[0]/l1 + d2[0]/l2;
    const my = d1[1]/l1 + d2[1]/l2;

    return Math.hypot(mx, my) < 1e-9 ? d1 : [mx, my];
}


export {
    getFatBranchTree,
    getSkeletonLength,
    getSkeletonBeziers
}
